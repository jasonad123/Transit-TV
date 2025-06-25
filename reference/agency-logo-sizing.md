# Agency Logo Sizing Guide

This guide covers how to properly size and position agency logos in the Transit-TV navbar.

## Overview

The navbar supports two logos:
- **Primary logo** (`--primary-logo-url`): Main Transit app logo (right side)
- **Secondary logo** (`--secondary-logo-url`): Agency/route logo (left side)

## SVG Logo Guidelines

### For Text-Based Logos

**Template:**
```xml
<svg viewBox="0 0 [width] 50" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="35" font-family="Arial, sans-serif" font-size="28" fill="currentColor">Your Text</text>
</svg>
```

**Sizing Formula:**
- ViewBox width = text length × 7px per character (approximately)
- Always use height of `50` for consistency
- Start text at `x="0"` for proper left alignment
- Use `y="35"` for consistent baseline alignment

**Examples:**
```xml
<!-- Short: "MTA" (3 chars) -->
<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="35" font-family="Arial, sans-serif" font-size="28" fill="currentColor">MTA</text>
</svg>

<!-- Medium: "route 365" (9 chars) -->
<svg viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="35" font-family="Arial, sans-serif" font-size="28" fill="currentColor">route 365</text>
</svg>

<!-- Long: "Metro Transit" (13 chars) -->
<svg viewBox="0 0 180 50" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="35" font-family="Arial, sans-serif" font-size="28" fill="currentColor">Metro Transit</text>
</svg>
```

### For Image-Based Logos (PNG, JPG, etc.)

Convert to SVG for best results:

```xml
<svg viewBox="0 0 [width] 50" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,[base64-data]" 
         x="0" y="0" 
         width="[width]" height="50" />
</svg>
```

**Or embed as background in CSS:**
- Place image in `/client/assets/images/`
- Reference in theme CSS variables
- Ensure image has transparent background
- Recommended height: 60-80px for crisp display

## CSS Configuration

The navbar automatically handles sizing through these CSS rules:

```css
#logo-alt {
  width: 12%;           /* Adjust for spacing */
  min-width: 100px;     /* Minimum size */
  padding-right: 15px;  /* Gap between logos */
}

#logo-alt a {
  background: var(--secondary-logo-url) no-repeat left center;
  background-size: auto 2em;  /* Height locked to 2em */
}
```

## Testing Your Logo

1. **Desktop**: Check at 1920px+ width
2. **Tablet**: Test responsive behavior at 1024px and below  
3. **Mobile**: Verify text doesn't get cut off at narrow widths
4. **Spacing**: Ensure proper gap between logos and centered title

## Common Issues

**Logo too wide:** Reduce viewBox width or font size
**Logo too small:** Increase font size or viewBox dimensions  
**Text cut off:** Check responsive CSS rules and min-width values
**Poor alignment:** Verify `y="35"` positioning and baseline consistency

## Theme Integration

Add to your theme CSS:
```css
:root {
  --secondary-logo-url: url('/assets/images/your-logo.svg');
}
```

Enable secondary logo display:
```html
<table class="show-secondary-logo">
```