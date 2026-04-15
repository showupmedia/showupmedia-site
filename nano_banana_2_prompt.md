# Nano Banana 2 - 3D Scroll Animation Prompt for Show Up Media

## CRITICAL REQUIREMENT: 3D SCROLL ANIMATION IS MANDATORY
**THIS IS NOT OPTIONAL - THE ENTIRE PROJECT FOCUSES ON 3D SCROLL ANIMATION**

## Project Overview
Create an impressive **3D SCROLL ANIMATION** for Show Up Media's website that showcases their booking system options and services. The **3D scroll animation** must be the centerpiece of this design - not just an add-on. Every element should be part of the 3D scroll experience. The animation should be visually stunning, modern, and professional while maintaining the dark theme aesthetic.

## Current Site Context
- Dark theme website (#080808 background, #2D8EFF accent color)
- Show Up Media - Short-form content specialists
- Custom cursor effects already implemented
- Modern, tech-forward design aesthetic
- Target audience: businesses needing content creation services

## Animation Requirements

### 1. 3D SCROLL ANIMATION SEQUENCE (MANDATORY)
**THIS IS THE CORE REQUIREMENT - EVERYTHING MUST BE 3D SCROLL ANIMATED**

Create a multi-stage **3D scroll animation** that reveals content progressively:

**Stage 1: CHAOS - Messy Current State (Top of Page)**
- **3D scattered elements** representing 100 different systems (calendars, spreadsheets, sticky notes, apps)
- **Overlapping booking conflicts** shown as red X marks and warning symbols
- **Chaotic particle system** with disorganized movement and collisions
- **Broken calendar pages** and tangled wires floating in 3D space
- **Frustrated customer avatars** looking confused among the mess
- **Text "Tired of This Chaos?"** appears as user scrolls

**Stage 2: TRANSFORMATION - The Magic Happens (Middle Scroll)**
- **3D objects start organizing** themselves as user scrolls
- **Scattered elements fly together** and form structured patterns
- **Messy particles align** into clean geometric shapes
- **Broken pieces reassemble** into a cohesive booking system
- **Color transitions** from chaotic reds/oranges to organized blues
- **Camera pulls back** to show the transformation happening
- **Text "We Clean Up the Mess"** emerges during transformation

**Stage 3: ORDER - Clean Booking System (Bottom of Page)**
- **Perfectly organized 3D booking interface** with clean lines
- **Harmonious particle system** with smooth, predictable movement
- **Integrated calendar** showing no conflicts, all bookings organized
- **Happy customer avatars** using the clean system effortlessly
- **3D pricing cards** that emerge from the organized system
- **Text "Simple. Organized. Effective."** as the final message

**THE STORY NARRATIVE:**
- **Start:** User sees visual chaos representing their current pain points
- **Middle:** Scroll triggers magical organization and cleanup
- **End:** User arrives at the perfect solution - Show Up Media's booking system

**CRITICAL 3D SCROLL EXAMPLES TO REFERENCE:**
- Apple iPhone 15 Pro website (3D scroll animations)
- Stripe website (3D scroll effects)
- Airbnb website (3D scroll storytelling)
- Tesla website (3D scroll experience)

### 2. Booking System Integration

**Option 1: Static Booking System - $25/month**
- 3D animated card showcasing basic booking features
- Simple calendar interface preview
- "Perfect for small businesses" messaging
- Hover effects showing feature highlights

**Option 2: 3D Booking System - $50/month**
- Premium 3D card with enhanced animation
- Interactive 3D calendar preview
- "Advanced booking experience" messaging
- Glowing effects and premium visual treatment

**Option 3: Website Building Inquiry**
- Contact form with 3D input fields
- Information collection for custom websites
- "Get a custom website" call-to-action
- Animated submit button with success states

### 3. Technical Specifications - 3D SCROLL IMPLEMENTATION

**MANDATORY 3D SCROLL LIBRARIES:**
- **Three.js** for 3D scene and camera control
- **GSAP ScrollTrigger** for scroll-based animations
- **Lenis** for smooth scrolling experience
- **Intersection Observer API** for scroll-triggered animations

**3D SCROLL ARCHITECTURE - Chaos to Order:**
```javascript
// Chaos to Order transformation system
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
const renderer = new THREE.WebGLRenderer();

// Create chaotic elements
const chaoticElements = [];
const scatteredCalendars = [];
const tangledWires = [];
const warningSymbols = [];

// Create organized elements (initially hidden)
const organizedCalendar = new THREE.Group();
const cleanDashboard = new THREE.Group();
const successElements = new THREE.Group();

// Scroll-based transformation timeline
gsap.timeline({
  scrollTrigger: {
    trigger: ".transformation-3d",
    start: "top top",
    end: "bottom top",
    scrub: 1,
    pin: true
  }
})

// Stage 1: Chaos (0-30% scroll)
.fromTo(chaoticElements, 
  {position: "random()", rotation: "random()", scale: 1},
  {position: "random()", rotation: "random()", scale: 1},
  0
)
.fromTo(warningSymbols,
  {opacity: 1, scale: 1},
  {opacity: 1, scale: 1},
  0
)

// Stage 2: Transformation (30-70% scroll)
.to(chaoticElements, {
  position: (i) => `+=${i * 0.5}`,
  rotation: 0,
  scale: 0.8,
  opacity: 0.5
}, 0.3)
.to(tangledWires, {
  position: {x: 0, y: 0, z: 0},
  rotation: 0
}, 0.3)
.to(warningSymbols, {
  opacity: 0,
  scale: 0
}, 0.3)

// Stage 3: Order (70-100% scroll)
.fromTo(organizedCalendar,
  {opacity: 0, scale: 0.5},
  {opacity: 1, scale: 1},
  0.7
)
.fromTo(cleanDashboard,
  {opacity: 0, y: 50},
  {opacity: 1, y: 0},
  0.8)
.fromTo(successElements,
  {opacity: 0, scale: 0},
  {opacity: 1, scale: 1},
  0.9)

// Camera movement through the transformation
.to(camera.position, {
  z: 10,
  ease: "power2.inOut"
}, 0.3)
.to(camera.position, {
  z: 5,
  ease: "power2.inOut"
}, 0.7);
```

**Performance Requirements:**
- **60fps** scroll animations at all times
- **GPU acceleration** for all 3D transforms
- **Optimized draw calls** and texture loading
- **Smooth scrolling** with momentum and easing
- **Mobile optimization** with reduced complexity on smaller screens

**SCROLL TRIGGER IMPLEMENTATION:**
- Every element must be **scroll-triggered**
- **Progress-based animations** tied to scroll position
- **Parallax effects** with different scroll speeds
- **3D perspective changes** as user scrolls
- **Staggered animations** for multiple elements

**Visual Effects - Chaos to Order Transformation:**
- **Chaotic Stage:** Red/orange warning colors, jagged movements, collision particles
- **Transformation Stage:** Color morphing from reds to blues, particles aligning, objects magnetizing together
- **Order Stage:** Clean blue theme (#2D8EFF), smooth particle flows, organized layouts
- **Depth of field** that focuses from messy foreground to clean background
- **Dynamic lighting** that changes from chaotic flashing to steady, professional lighting
- **Particle systems** that evolve from random chaos to organized patterns
- **Sound effects** (optional): chaotic sounds that transition to peaceful, organized tones

**Specific 3D Objects for Chaos Stage:**
- **Scattered calendars** with overlapping dates
- **Floating spreadsheets** with conflicting data
- **Tangled wires** representing disconnected systems
- **Broken app icons** from various booking platforms
- **Sticky notes** with conflicting information
- **Warning triangles** and error symbols
- **Clocks** showing different times (time zone confusion)

**Specific 3D Objects for Order Stage:**
- **Unified calendar interface** with clean layout
- **Integrated dashboard** showing all bookings
- **Connected nodes** representing unified system
- **Clean app interface** with single branding
- **Organized workflow** diagrams
- **Success checkmarks** and smooth indicators
- **Synchronized clocks** showing perfect timing

### 4. Interactive Elements

**Scroll-triggered Animations:**
- Elements appear as user scrolls
- Progressive disclosure of information
- Smooth transitions between sections

**Hover States:**
- 3D card tilts and rotations
- Glow effects on interactive elements
- Smooth scale transformations

**Micro-interactions:**
- Button press animations
- Form field focus effects
- Success/error state animations

### 5. Content Structure

```html
<!-- 3D Hero Section -->
<section class="hero-3d">
  <div class="floating-elements-3d"></div>
  <h1 class="title-3d">Show Up Media</h1>
  <p class="subtitle-3d">Short-Form Content Specialists</p>
</section>

<!-- 3D Booking Options -->
<section class="booking-options-3d">
  <div class="option-card-3d static">
    <h3>Static Booking System</h3>
    <div class="price">$25/month</div>
    <ul class="features-3d"></ul>
  </div>
  
  <div class="option-card-3d premium">
    <h3>3D Booking System</h3>
    <div class="price">$50/month</div>
    <ul class="features-3d"></ul>
  </div>
  
  <div class="option-card-3d website">
    <h3>Custom Website</h3>
    <p>Get a quote for your custom website</p>
    <form class="contact-form-3d"></form>
  </div>
</section>
```

### 6. Design Guidelines

**Color Scheme:**
- Primary: #080808 (dark background)
- Accent: #2D8EFF (blue highlights)
- Secondary: #F0EEE8 (text)
- Gradients and glows using accent colors

**Typography:**
- Syne font family for headings (already loaded)
- DM Sans for body text (already loaded)
- 3D text effects with depth and shadows

**Visual Style:**
- Modern, tech-forward aesthetic
- Subtle animations, not overwhelming
- Professional and clean design
- Consistent with existing brand identity

### 7. Mobile Considerations

**Responsive 3D:**
- Simplified 3D effects on mobile
- Touch-friendly interactions
- Optimized performance for mobile devices
- Progressive enhancement approach

**Mobile Animations:**
- Reduced complexity for better performance
- Touch-activated instead of scroll-triggered
- Shorter animation durations

### 8. Implementation Notes

**File Structure:**
```
/assets/js/three-scene.js      # Main 3D scene setup
/assets/js/scroll-animations.js # Scroll-triggered animations
/assets/css/3d-styles.css      # 3D-specific styles
/assets/models/                # 3D models (if any)
```

**Integration Points:**
- Integrate with existing cursor effects
- Maintain current navigation structure
- Preserve existing functionality
- Add to current pages without breaking features

**Testing Requirements:**
- Cross-browser compatibility
- Performance testing on various devices
- Accessibility compliance for 3D elements
- Fallback options for unsupported browsers

### 9. Success Metrics

**Visual Impact:**
- Wow factor on first load
- Smooth, professional animations
- Clear communication of value propositions

**User Experience:**
- Intuitive navigation through 3D space
- Clear call-to-action buttons
- Fast loading and smooth performance

**Conversion Goals:**
- Easy selection of booking options
- Simple contact form for website inquiries
- Clear pricing presentation

## VALIDATION CHECKLIST - 3D SCROLL ANIMATION MUST BE PRESENT

**BEFORE SUBMITTING, VERIFY THESE 3D SCROLL FEATURES EXIST:**

### Must-Have 3D Scroll Elements:
- [ ] **Three.js scene** with 3D objects
- [ ] **GSAP ScrollTrigger** animations tied to scroll position
- [ ] **3D camera movement** as user scrolls
- [ ] **Parallax effects** with multiple depth layers
- [ ] **Scroll-triggered animations** for all major elements
- [ ] **3D transforms** (rotation, scale, position) on scroll
- [ ] **Smooth scrolling** with Lenis or similar
- [ ] **Chaos-to-order transformation** as the main narrative

### Test These Scroll Interactions:
- [ ] Scroll down and see 3D objects move/transform
- [ ] Scroll up and see reverse animations
- [ ] Different scroll speeds for parallax layers
- [ ] 3D perspective changes based on scroll progress
- [ ] Elements appearing/disappearing based on scroll position
- [ ] **Chaos stage** shows messy, scattered elements at top
- [ ] **Transformation stage** shows elements organizing during middle scroll
- [ ] **Order stage** shows clean, organized system at bottom
- [ ] **Color transition** from reds/oranges to blues during scroll
- [ ] **Particle system** evolves from chaotic to organized

### Performance Validation:
- [ ] 60fps animations during scroll
- [ ] No lag or stuttering
- [ ] Mobile devices work smoothly
- [ ] GPU acceleration active

## Deliverables

1. **MANDATORY 3D SCROLL IMPLEMENTATION** - Complete Three.js + GSAP ScrollTrigger system
2. **Scroll-Triggered Animations** - Every element animates on scroll
3. **3D Scene with Camera Movement** - Dynamic camera that moves through 3D space
4. **Interactive 3D Cards** - Pricing/booking options with 3D transforms
5. **Contact Form Integration** - 3D form elements that animate on scroll
6. **Mobile Optimization** - Responsive 3D scroll effects for all devices
7. **Performance Optimization** - 60fps scroll animations
8. **Cross-browser Support** - Works on all modern browsers
9. **Documentation** - Code comments explaining 3D scroll implementation

## FINAL REQUIREMENT CHECK

**IF THE DESIGN DOES NOT HAVE 3D SCROLL ANIMATIONS, IT IS NOT COMPLETE.**

The 3D scroll animation is not an optional feature - it is the entire point of this project. A static website with 3D elements that don't animate on scroll is NOT acceptable.

**Examples of what IS NOT acceptable:**
- Static 3D graphics that don't move on scroll
- Simple CSS animations not tied to scroll position
- Hover effects without scroll-based animations
- Parallax without 3D transforms
- **Missing the chaos-to-order transformation story**
- **No narrative showing messy systems becoming organized**
- **Generic 3D animations without the booking system context**

**Examples of what IS acceptable:**
- 3D objects that move/rotate as user scrolls
- Camera that travels through 3D space on scroll
- Elements that appear/disappear based on scroll progress
- Multiple layers moving at different speeds in 3D space
- **Clear visual story from chaos (messy booking) to order (clean system)**
- **Scattered calendars and apps organizing into a unified interface**
- **Color transitions from warning reds to professional blues**
- **User pain points (double booking, confusion) transforming into solutions**

## Technical Constraints

- Must work with existing site structure
- Maintain current SEO and accessibility
- No breaking changes to existing functionality
- Optimized for performance and user experience
- Progressive enhancement approach

## Timeline & Priority

**Phase 1 (High Priority):**
- Basic 3D scene setup
- Hero section animation
- Scroll-triggered content reveal

**Phase 2 (Medium Priority):**
- Interactive booking cards
- Contact form integration
- Mobile optimization

**Phase 3 (Low Priority):**
- Advanced particle effects
- Additional micro-interactions
- Performance fine-tuning

---

This prompt provides comprehensive guidance for creating an impressive 3D scroll animation that showcases Show Up Media's booking options while maintaining their professional brand identity and technical requirements.
