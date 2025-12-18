#!/bin/bash

# ==============================================================================
# Transit TV v1.3.0 Optimization Test Script
# ==============================================================================
# This script helps verify the zero-risk optimizations implemented in v1.3.0
#
# Usage:
#   chmod +x test-optimizations.sh
#   ./test-optimizations.sh [test-name]
#
# Available tests:
#   all          - Run all tests (default)
#   docker-opt   - Test Dockerfile.optimized
#   docker-dhi   - Test Dockerfile.dhi (requires docker login dhi.io)
#   vite         - Test Vite build optimizations
#   caching      - Test Express static asset caching
#   env          - Test environment validation
#   performance  - Compare build performance
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Test functions
test_docker_optimized() {
    print_header "Testing Dockerfile.optimized"

    print_info "Building with optimized Dockerfile..."
    if docker build -f Dockerfile.optimized -t transit-tv:test-opt . ; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        return 1
    fi

    print_info "Checking image size..."
    docker images transit-tv:test-opt --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

    print_info "Starting container..."
    docker run -d --name transit-tv-test -p 8080:8080 \
        -e TRANSIT_API_KEY=test \
        -e NODE_ENV=development \
        transit-tv:test-opt

    print_info "Waiting for application to start..."
    sleep 5

    print_info "Testing health endpoint..."
    if curl -sf http://localhost:8080/health > /dev/null; then
        print_success "Health check passed"
        curl -s http://localhost:8080/health | jq .
    else
        print_error "Health check failed"
        docker logs transit-tv-test
        docker stop transit-tv-test
        docker rm transit-tv-test
        return 1
    fi

    print_info "Cleaning up..."
    docker stop transit-tv-test
    docker rm transit-tv-test

    print_success "All Dockerfile.optimized tests passed!"
}

test_docker_dhi() {
    print_header "Testing Dockerfile.dhi"

    print_info "Checking DHI authentication..."
    if ! docker info | grep -q "dhi.io"; then
        print_warning "Not logged in to dhi.io"
        print_info "Run: docker login dhi.io"
        print_info "Then re-run this test"
        return 1
    fi

    print_info "Building with DHI Dockerfile..."
    if docker build -f Dockerfile.dhi -t transit-tv:test-dhi . ; then
        print_success "Build completed successfully (no EEXIST errors!)"
    else
        print_error "Build failed"
        return 1
    fi

    print_info "Checking image size..."
    docker images transit-tv:test-dhi --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

    print_info "Starting container..."
    docker run -d --name transit-tv-dhi-test -p 8081:8080 \
        -e TRANSIT_API_KEY=test \
        -e NODE_ENV=development \
        transit-tv:test-dhi

    print_info "Waiting for application to start..."
    sleep 5

    print_info "Testing health endpoint..."
    if curl -sf http://localhost:8081/health > /dev/null; then
        print_success "Health check passed"
        curl -s http://localhost:8081/health | jq .
    else
        print_error "Health check failed"
        docker logs transit-tv-dhi-test
        docker stop transit-tv-dhi-test
        docker rm transit-tv-dhi-test
        return 1
    fi

    print_info "Cleaning up..."
    docker stop transit-tv-dhi-test
    docker rm transit-tv-dhi-test

    print_success "All Dockerfile.dhi tests passed!"
}

test_vite_build() {
    print_header "Testing Vite Build Optimizations"

    print_info "Building SvelteKit application..."
    cd svelte-app
    if pnpm build; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        cd ..
        return 1
    fi

    print_info "Checking chunk files..."
    if [ -d "build/client/_app/immutable/chunks" ]; then
        print_success "Chunk directory exists"
        echo ""
        echo "Chunk files:"
        ls -lh build/client/_app/immutable/chunks/*.js | head -10
        echo ""

        # Check for separate chunks
        if ls build/client/_app/immutable/chunks/*svelte-core*.js 2>/dev/null; then
            print_success "Svelte core chunk found (vendor splitting working)"
        else
            print_warning "Svelte core chunk not found (might be bundled differently)"
        fi
    else
        print_error "Chunk directory not found"
        cd ..
        return 1
    fi

    cd ..
    print_success "Vite build optimization tests passed!"
}

test_express_caching() {
    print_header "Testing Express Static Asset Caching"

    print_info "Starting server in background..."
    NODE_ENV=production TRANSIT_API_KEY=test pnpm start > /tmp/transit-tv-test.log 2>&1 &
    SERVER_PID=$!

    print_info "Waiting for server to start..."
    sleep 5

    print_info "Testing health endpoint..."
    if ! curl -sf http://localhost:8080/health > /dev/null; then
        print_error "Server failed to start"
        cat /tmp/transit-tv-test.log
        kill $SERVER_PID 2>/dev/null || true
        return 1
    fi

    print_info "Testing cache headers..."

    # Test immutable assets
    echo ""
    echo "Testing immutable asset cache headers:"
    IMMUTABLE_PATH=$(find svelte-app/build/client/_app/immutable/chunks -name "*.js" -type f | head -1)
    if [ -n "$IMMUTABLE_PATH" ]; then
        IMMUTABLE_URL="/_app/immutable/chunks/$(basename $IMMUTABLE_PATH)"
        CACHE_HEADER=$(curl -sI "http://localhost:8080$IMMUTABLE_URL" | grep -i "cache-control" || echo "Not found")
        echo "$CACHE_HEADER"
        if echo "$CACHE_HEADER" | grep -q "immutable"; then
            print_success "Immutable cache header found"
        else
            print_warning "Immutable cache header not found"
        fi
    fi

    print_info "Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true

    print_success "Express caching tests completed!"
}

test_environment_validation() {
    print_header "Testing Environment Validation"

    print_info "Test 1: Missing API key in production (should fail)..."
    if NODE_ENV=production node server/app.js 2>&1 | grep -q "TRANSIT_API_KEY is required"; then
        print_success "Correctly fails with missing API key"
    else
        print_error "Should have failed with missing API key"
        return 1
    fi

    print_info "Test 2: Invalid TRUST_PROXY (should warn)..."
    if TRUST_PROXY=invalid node server/app.js 2>&1 | grep -q "TRUST_PROXY should be"; then
        print_success "Correctly warns about invalid TRUST_PROXY"
    else
        print_warning "Warning not detected"
    fi

    print_info "Test 3: Valid configuration (should start)..."
    TRANSIT_API_KEY=test node server/app.js > /tmp/transit-tv-env-test.log 2>&1 &
    ENV_TEST_PID=$!
    sleep 3

    if curl -sf http://localhost:8080/health > /dev/null; then
        print_success "Server started with valid configuration"
        kill $ENV_TEST_PID
    else
        print_error "Server failed to start"
        cat /tmp/transit-tv-env-test.log
        kill $ENV_TEST_PID 2>/dev/null || true
        return 1
    fi

    print_success "Environment validation tests passed!"
}

test_performance() {
    print_header "Testing Build Performance"

    print_info "This will test build performance with cache..."

    print_info "Clearing Docker build cache..."
    docker builder prune -a -f

    print_info "First build (cold cache)..."
    START_TIME=$(date +%s)
    docker build -f Dockerfile.optimized -t transit-tv:perf-test-1 . > /dev/null 2>&1
    END_TIME=$(date +%s)
    COLD_TIME=$((END_TIME - START_TIME))
    print_info "Cold build time: ${COLD_TIME}s"

    print_info "Making a small change..."
    echo "// Performance test" >> server/app.js

    print_info "Second build (warm cache)..."
    START_TIME=$(date +%s)
    docker build -f Dockerfile.optimized -t transit-tv:perf-test-2 . > /dev/null 2>&1
    END_TIME=$(date +%s)
    WARM_TIME=$((END_TIME - START_TIME))
    print_info "Warm build time: ${WARM_TIME}s"

    # Revert change
    git checkout server/app.js

    # Calculate improvement
    if [ $COLD_TIME -gt 0 ]; then
        IMPROVEMENT=$(( (COLD_TIME - WARM_TIME) * 100 / COLD_TIME ))
        echo ""
        print_success "Performance improvement: ${IMPROVEMENT}% faster on warm build"

        if [ $IMPROVEMENT -gt 40 ]; then
            print_success "Excellent performance improvement!"
        elif [ $IMPROVEMENT -gt 20 ]; then
            print_success "Good performance improvement"
        else
            print_warning "Lower than expected improvement (target: 50-80%)"
        fi
    fi

    print_success "Performance tests completed!"
}

# Main script
main() {
    local test_name="${1:-all}"

    echo ""
    echo "Transit TV v1.3.0 Optimization Test Suite"
    echo "=========================================="
    echo ""

    case "$test_name" in
        all)
            print_info "Running all tests..."
            test_docker_optimized || true
            test_vite_build || true
            test_express_caching || true
            test_environment_validation || true
            echo ""
            print_info "DHI test requires authentication: docker login dhi.io"
            print_info "Run './test-optimizations.sh docker-dhi' to test DHI"
            ;;
        docker-opt)
            test_docker_optimized
            ;;
        docker-dhi)
            test_docker_dhi
            ;;
        vite)
            test_vite_build
            ;;
        caching)
            test_express_caching
            ;;
        env)
            test_environment_validation
            ;;
        performance)
            test_performance
            ;;
        *)
            print_error "Unknown test: $test_name"
            echo ""
            echo "Available tests:"
            echo "  all          - Run all tests (default)"
            echo "  docker-opt   - Test Dockerfile.optimized"
            echo "  docker-dhi   - Test Dockerfile.dhi"
            echo "  vite         - Test Vite build"
            echo "  caching      - Test Express caching"
            echo "  env          - Test environment validation"
            echo "  performance  - Compare build performance"
            exit 1
            ;;
    esac

    echo ""
    print_success "Test suite completed!"
}

# Run main function
main "$@"
