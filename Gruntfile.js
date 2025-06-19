// Generated on 2015-11-06 using generator-angular-fullstack 2.1.1
'use strict';

module.exports = function (grunt) {
  var localConfig;
  try {
    localConfig = require('./server/config/local.env');
  } catch(e) {
    localConfig = {};
  }

  // Load grunt tasks automatically, when needed
  require('jit-grunt')(grunt, {
    express: 'grunt-express-server',
    useminPrepare: 'grunt-usemin',
    ngtemplates: 'grunt-angular-templates',
    buildcontrol: 'grunt-build-control'
  });

    // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    pkg: grunt.file.readJSON('package.json'),

    yeoman: {
      // configurable paths
      client: 'client',
      dist: 'dist',
      node_modules: 'node_modules'
    },

    express: {
      options: {
        port: process.env.PORT || 7753
      },

      dev: {
        options: {
          script: 'server/app.js',
          debug: true
        }
      },

      prod: {
        options: {
          script: 'dist/server/app.js'
        }
      }
    },

    open: {
      server: {
        url: 'http://localhost:<%= express.options.port %>'
      }
    },

    watch: {
      injectJS: {
        files: [
          '<%= yeoman.client %>/{app,components,directives,services}/**/*.js',
          '!<%= yeoman.client %>/app/app.js'],
        tasks: ['injector:scripts']
      },

      injectCss: {
        files: [
          '<%= yeoman.client %>/{app,components,directives}/**/*.css'
        ],
        tasks: ['injector:css']
      },

      gruntfile: {
        files: ['Gruntfile.js']
      },

      livereload: {
        files: [
          '{.tmp,<%= yeoman.client %>}/{app,components,directives}/**/*.css',
          '{.tmp,<%= yeoman.client %>}/{app,components,directives}/**/*.html',
          '{.tmp,<%= yeoman.client %>}/{app,components,directives,services}/**/*.js',

          '<%= yeoman.client %>/assets/images/{,*//*}*.{png,jpg,jpeg,gif,webp,svg}',
          '<%= yeoman.client %>/assets/i18n/*.json'
        ],
        options: {
          livereload: true
        }
      },

      express: {
        files: [
          'server/**/*.{js,json}'
        ],
        tasks: ['express:dev', 'wait'],
        options: {
          livereload: true,
          nospawn: true //Without this option specified express won't be reloaded
        }
      }
    },

    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '<%= yeoman.client %>/.jshintrc',
        reporter: require('jshint-stylish')
      },

      server: {
        options: {
          jshintrc: 'server/.jshintrc'
        },
        src: [
          'server/**/*.js',
          '!server/**/*.spec.js'
        ]
      },

      all: [
        '<%= yeoman.client %>/{app,components,directives,services}/**/*.js'
      ]
    },

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= yeoman.dist %>/*',
            '!<%= yeoman.dist %>/.git*',
            '!<%= yeoman.dist %>/.openshift',
            '!<%= yeoman.dist %>/Procfile',
            '!<%= yeoman.dist %>/configs.json'
          ]
        }]
      },
      server: '.tmp'
    },

    // Add vendor prefixed styles
    autoprefixer: {
      options: {
        browsers: ['last 2 versions', 'not ie <= 11']
      },

      dist: {
        files: [{
          expand: true,
          cwd: '.tmp/',
          src: '{,*/}*.css',
          dest: '.tmp/'
        }]
      }
    },

    // Use nodemon to run server in debug mode with an initial breakpoint
    nodemon: {
      debug: {
        script: 'server/app.js',
        options: {
          nodeArgs: ['--debug-brk'],
          env: {
            PORT: process.env.PORT || 7753
          },
          callback: function (nodemon) {
            nodemon.on('log', function (event) {
              console.log(event.colour);
            });

            // opens browser on initial server start
            nodemon.on('config:update', function () {
              setTimeout(function () {
                require('open')('http://localhost:8080/debug?port=5858');
              }, 500);
            });
          }
        }
      }
    },

    // Copy dependencies from node_modules to client/vendor
    copy: {
      vendor: {
        files: [
          // Angular and related libraries
          {
            expand: true,
            cwd: 'node_modules/angular',
            src: ['angular.js', 'angular.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular'
          },
          {
            expand: true,
            cwd: 'node_modules/angular-cookies',
            src: ['angular-cookies.js', 'angular-cookies.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular-cookies'
          },
          {
            expand: true,
            cwd: 'node_modules/angular-resource',
            src: ['angular-resource.js', 'angular-resource.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular-resource'
          },
          {
            expand: true,
            cwd: 'node_modules/angular-sanitize',
            src: ['angular-sanitize.js', 'angular-sanitize.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular-sanitize'
          },
          {
            expand: true,
            cwd: 'node_modules/angular-ui-router/release',
            src: ['angular-ui-router.js', 'angular-ui-router.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular-ui-router'
          },
          {
            expand: true,
            cwd: 'node_modules/ui-select/dist',
            src: ['select.js', 'select.min.js', 'select.css', 'select.min.css'],
            dest: '<%= yeoman.client %>/vendor/angular-ui-select'
          },
          {
            expand: true,
            cwd: 'node_modules/angular-translate/dist',
            src: ['angular-translate.js', 'angular-translate.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular-translate'
          },
          {
            expand: true,
            cwd: 'node_modules/angular-translate-loader-static-files/dist',
            src: ['angular-translate-loader-static-files.js', 'angular-translate-loader-static-files.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular-translate-loader-static-files'
          },
          // jQuery and related libraries
          {
            expand: true,
            cwd: 'node_modules/jquery/dist',
            src: ['jquery.js', 'jquery.min.js'],
            dest: '<%= yeoman.client %>/vendor/jquery'
          },
          {
            expand: true,
            cwd: 'node_modules/jquery-ui',
            src: ['jquery-ui.js', 'jquery-ui.min.js'],
            dest: '<%= yeoman.client %>/vendor/jquery-ui'
          },
          {
            expand: true, 
            cwd: 'node_modules/angular-dragdrop/src',
            src: ['angular-dragdrop.js', 'angular-dragdrop.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular-dragdrop'
          },
          // Bootstrap
          {
            expand: true,
            cwd: 'node_modules/bootstrap/dist/css',
            src: ['bootstrap.css', 'bootstrap.min.css'],
            dest: '<%= yeoman.client %>/vendor/bootstrap/css'
          },
          {
            expand: true,
            cwd: 'node_modules/bootstrap/dist/js',
            src: ['bootstrap.js', 'bootstrap.min.js'],
            dest: '<%= yeoman.client %>/vendor/bootstrap/js'
          },
          {
            expand: true,
            cwd: 'node_modules/bootstrap/dist/fonts',
            src: ['*'],
            dest: '<%= yeoman.client %>/vendor/bootstrap/fonts'
          },
          // Moment
          {
            expand: true,
            cwd: 'node_modules/moment',
            src: ['moment.js', 'min/moment.min.js'],
            dest: '<%= yeoman.client %>/vendor/moment'
          },
          {
            expand: true, 
            cwd: 'node_modules/angular-moment',
            src: ['angular-moment.js', 'angular-moment.min.js'],
            dest: '<%= yeoman.client %>/vendor/angular-moment'
          }
        ]
      },
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: '<%= yeoman.client %>',
          dest: '<%= yeoman.dist %>/public',
          src: [
            '*.{ico,png,txt}',
            '.htaccess',
            'vendor/**/*',
            'assets/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}',
            'assets/fonts/**/*',
            'assets/i18n/*',
            'index.html'
          ]
        }, {
          expand: true,
          cwd: '.tmp/images',
          dest: '<%= yeoman.dist %>/public/assets/images',
          src: ['generated/*']
        }, {
          expand: true,
          dest: '<%= yeoman.dist %>',
          src: [
            'package.json',
            'server/**/*'
          ]
        }]
      },
      styles: {
        expand: true,
        cwd: '<%= yeoman.client %>',
        dest: '.tmp/',
        src: ['{app,components,directives}/**/*.css']
      }
    },

    // Renames files for browser caching purposes
    rev: {
      dist: {
        files: {
          src: [
            '<%= yeoman.dist %>/public/{,*/}*.js',
            '<%= yeoman.dist %>/public/{,*/}*.css',
            '<%= yeoman.dist %>/public/assets/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}'
          ]
        }
      }
    },

    // Reads HTML for usemin blocks to enable smart builds that automatically
    // concat, minify and revision files. Creates configurations in memory so
    // additional tasks can operate on them
    useminPrepare: {
      html: ['<%= yeoman.client %>/index.html'],
      options: {
        dest: '<%= yeoman.dist %>/public'
      }
    },

    // Performs rewrites based on rev and the useminPrepare configuration
    usemin: {
      html: ['<%= yeoman.dist %>/public/{,*/}*.html'],
      css: ['<%= yeoman.dist %>/public/{,*/}*.css'],
      js: ['<%= yeoman.dist %>/public/{,*/}*.js'],
      options: {
        assetsDirs: [
          '<%= yeoman.dist %>/public',
          '<%= yeoman.dist %>/public/assets/images'
        ],
        // This is so we update image references in our ng-templates
        patterns: {
          js: [
            [/(assets\/images\/.*?\.(?:gif|jpeg|jpg|png|webp|svg))/gm, 'Update the JS to reference our revved images']
          ]
        }
      }
    },

    // Allow the use of non-minsafe AngularJS files. Automatically makes it
    // minsafe compatible so Uglify does not destroy the ng references
    ngAnnotate: {
      dist: {
        files: [{
          expand: true,
          cwd: '.tmp/concat',
          src: '**/*.js',
          dest: '.tmp/concat'
        }]
      }
    },

    // Package all the html partials into a single javascript payload
    ngtemplates: {
      options: {
        // This should be the name of your apps angular module
        module: 'transitScreenApp',
        htmlmin: {
          collapseBooleanAttributes: true,
          collapseWhitespace: true,
          removeAttributeQuotes: true,
          removeEmptyAttributes: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          removeComments: true,
          minifyJS: true,
          minifyCSS: true
        },
        usemin: 'app/app.js'
      },
      main: {
        cwd: '<%= yeoman.client %>',
        src: ['{app,components,directives}/**/*.html'],
        dest: '.tmp/templates.js'
      },
      tmp: {
        cwd: '.tmp',
        src: ['{app,components,directives}/**/*.html'],
        dest: '.tmp/tmp-templates.js'
      }
    },



    buildcontrol: {
      options: {
        dir: 'dist',
        commit: true,
        push: true,
        connectCommits: false,
        message: 'Built %sourceName% from commit %sourceCommit% on branch %sourceBranch%'
      },
      heroku: {
        options: {
          remote: 'heroku',
          branch: 'master'
        }
      },
      openshift: {
        options: {
          remote: 'openshift',
          branch: 'master'
        }
      }
    },

    // Run some tasks in parallel to speed up the build process
    concurrent: {
      server: [
      ],
      debug: {
        tasks: [
          'nodemon'
        ],
        options: {
          logConcurrentOutput: true
        }
      },
      dist: [
        // Removed imagemin task reference
      ]
    },

    env: {
      prod: {
        NODE_ENV: 'production'
      },
      all: localConfig
    },

    injector: {
      options: {

      },
      // Inject application script files into index.html (doesn't include bower)
      scripts: {
        options: {
          transform: function(filePath) {
            filePath = filePath.replace('/client/', '');
            filePath = filePath.replace('/.tmp/', '');
            return '<script src="' + filePath + '"></script>';
          },
          starttag: '<!-- injector:js -->',
          endtag: '<!-- endinjector -->'
        },
        files: {
          '<%= yeoman.client %>/index.html': [
             '{.tmp,<%= yeoman.client %>}/{app,components,directives,services}/**/*.js',
             '!{.tmp,<%= yeoman.client %>}/app/app.js'
          ]
        }
      },

      // Inject component css into index.html
      css: {
        options: {
          transform: function(filePath) {
            filePath = filePath.replace('/client/', '');
            filePath = filePath.replace('/.tmp/', '');
            return '<link rel="stylesheet" href="' + filePath + '">';
          },
          starttag: '<!-- injector:css -->',
          endtag: '<!-- endinjector -->'
        },
        files: {
          '<%= yeoman.client %>/index.html': [
            '<%= yeoman.client %>/{app,components,directives}/**/*.css',
            '!{.tmp,<%= yeoman.client %>}/app/app.css'
          ]
        }
      }
    },
  });

  // Used for delaying livereload until after server has restarted
  grunt.registerTask('wait', function () {
    grunt.log.ok('Waiting for server reload...');

    var done = this.async();

    setTimeout(function () {
      grunt.log.writeln('Done waiting!');
      done();
    }, 1500);
  });

  grunt.registerTask('express-keepalive', 'Keep grunt running', function() {
    this.async();
  });

  grunt.registerTask('serve', function (target) {
    if (target === 'dist') {
      return grunt.task.run(['build', 'env:all', 'env:prod', 'express:prod', 'wait', 'open', 'express-keepalive']);
    }

    if (target === 'debug') {
      return grunt.task.run([
        'clean:server',
        'env:all',
        'concurrent:server',
        'copy:vendor',
        'injector',
        'autoprefixer',
        'concurrent:debug'
      ]);
    }

    grunt.task.run([
      'clean:server',
      'env:all',
      'concurrent:server',
      'copy:vendor',
      'injector',
      'autoprefixer',
      'express:dev',
      'wait',
      'open',
      'watch'
    ]);
  });

  grunt.registerTask('build', [
    'clean:dist',
    'concurrent:dist',
    'injector',
    'useminPrepare',
    'autoprefixer',
    'ngtemplates',
    'concat',
    'ngAnnotate',
    'copy:dist',
    'cssmin',
    'uglify',
    'rev',
    'usemin'
  ]);

  grunt.registerTask('default', [
    'newer:jshint',
    'build'
  ]);
};
