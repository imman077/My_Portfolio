// Force manual scroll restoration to prevent browser conflicts with custom section loading
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Lock body scrolling during preloading
document.body.style.overflow = "hidden";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const NUM_FRAMES = 240;
const sections = [
    { name: "hero", folder: "hero_section", canvasId: "hero-canvas", images: [], numFrames: 150 },
    { name: "about", folder: "about_me_section", canvasId: "about-canvas", images: [], numFrames: 80 },
    { name: "service", folder: "service_section", canvasId: "services-canvas", images: [], numFrames: 240 }
];

// Playhead structures for GSAP animation
const playheads = {
    hero: { frame: 0 },
    about: { frame: 0 },
    service: { frame: 0 }
};

// Set up image loading schedules
const criticalIndices = new Set();
// 1. Critical: first 45 frames for immediate playback
for (let i = 0; i < 45; i++) {
    criticalIndices.add(i);
}
// 2. Critical: every 6th frame to act as navigation anchors
for (let i = 45; i < NUM_FRAMES; i++) {
    if (i % 6 === 0 || i === NUM_FRAMES - 1) {
        criticalIndices.add(i);
    }
}

const criticalList = Array.from(criticalIndices);
const nonCriticalList = [];
for (let i = 0; i < NUM_FRAMES; i++) {
    if (!criticalIndices.has(i)) {
        nonCriticalList.push(i);
    }
}

// Pre-allocate image arrays
sections.forEach(sec => {
    sec.images = new Array(sec.numFrames);
    sec.canvas = document.getElementById(sec.canvasId);
    sec.ctx = sec.canvas.getContext("2d");
});

let criticalLoadedCount = 0;
// Calculate total critical frames that will actually load (filtering out-of-bounds frames)
let totalCritical = 0;
sections.forEach(sec => {
    criticalList.forEach(idx => {
        if (idx < sec.numFrames) {
            totalCritical++;
        }
    });
});

// Helper: Padding number to 3-digit strings (001, 002... 240)
function pad(num, size) {
    let s = "000" + num;
    return s.substring(s.length - size);
}

let introFinished = false;
let criticalLoaded = false;
let preloaderDismissed = false;

// Cinematic intro animation sequence for initial page load
function startIntroSequence() {
    if (typeof gsap === "undefined") {
        introFinished = true;
        checkAndDismissPreloader();
        return;
    }

    // Set initial GSAP states
    gsap.set("#intro-letter-i", { opacity: 0, scale: 0.4, y: 25 });
    gsap.set("#intro-rest-wrapper", { maxWidth: 0, opacity: 0 });
    gsap.set("#intro-subtitle", { opacity: 0, y: 15 });
    gsap.set(".loader-bar-wrapper, .loader-info-row", { opacity: 0 });

    const tl = gsap.timeline({
        onComplete: () => {
            introFinished = true;
            checkAndDismissPreloader();
        }
    });

    // 1. "I" comes in center of screen
    tl.to("#intro-letter-i", {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.85,
        ease: "back.out(1.7)"
    });

    // Brief dramatic pause at center
    tl.to({}, { duration: 0.2 });

    // 2. "I" shifts left as "MMANUVEL A" unveils to the right
    tl.to("#intro-rest-wrapper", {
        maxWidth: "1200px",
        opacity: 1,
        duration: 1.25,
        ease: "power3.inOut"
    });

    // 3. Subtitle appears below
    tl.to("#intro-subtitle", {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out"
    }, "-=0.35");

    // 4. Loader bar container fades in
    tl.to(".loader-bar-wrapper, .loader-info-row", {
        opacity: 1,
        duration: 0.4,
        ease: "power1.out"
    }, "-=0.2");
}

function checkAndDismissPreloader() {
    if (introFinished && criticalLoaded && !preloaderDismissed) {
        preloaderDismissed = true;
        dismissPreloader();
    }
}

function dismissPreloader() {
    // Play background animation video effect EXACTLY ONE TIME as an intro overlay right when preloader finishes
    const bgVideo = document.getElementById("hero-bg-video");
    if (bgVideo) {
        bgVideo.style.display = "block";
        bgVideo.currentTime = 0;
        bgVideo.loop = false; // Play EXACTLY ONE TIME

        // Handle video end: fade out smoothly after running 1 time
        bgVideo.onended = () => {
            if (typeof gsap !== "undefined") {
                gsap.to(bgVideo, { 
                    opacity: 0, 
                    duration: 0.8, 
                    ease: "power2.out",
                    onComplete: () => {
                        bgVideo.style.display = "none";
                    }
                });
            } else {
                bgVideo.style.opacity = "0";
                bgVideo.style.display = "none";
            }
        };

        const playPromise = bgVideo.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => console.log("Video playback error handled:", err));
        }
        
        if (typeof gsap !== "undefined") {
            gsap.to(bgVideo, { opacity: 0.85, duration: 0.6, ease: "power2.out" });
        } else {
            bgVideo.style.opacity = "0.85";
        }
    }

    if (typeof gsap === "undefined") {
        const preloader = document.getElementById("preloader");
        if (preloader) preloader.style.display = "none";
        document.body.style.overflow = "";
        resizeCanvases();
        initAnimations();
        loadBackgroundFrames();
        return;
    }

    // Initialize animations, restore scroll position, and start background frame loading
    // under the cover of the preloader to prevent a flash of the home section
    resizeCanvases();
    initAnimations();
    loadBackgroundFrames();

    const dismissTl = gsap.timeline({
        onComplete: () => {
            const preloader = document.getElementById("preloader");
            if (preloader) preloader.style.display = "none";
            document.body.style.overflow = "";
        }
    });

    // Direct smooth zoom and fade transition into main UI
    dismissTl.to("#preloader", {
        opacity: 0,
        scale: 1.05,
        duration: 1,
        ease: "power2.inOut"
    });
}

// Start preloading critical assets
function initLoading() {
    let loaderTriggered = false;

    // Trigger intro animation sequence
    startIntroSequence();

    const triggerLoadedOnce = () => {
        if (!loaderTriggered) {
            loaderTriggered = true;
            criticalLoaded = true;
            checkAndDismissPreloader();
        }
    };

    // Safety fallback: ensure preloader finishes smoothly after max 3.5 seconds
    setTimeout(triggerLoadedOnce, 3500);

    sections.forEach(sec => {
        criticalList.forEach(idx => {
            if (idx >= sec.numFrames) return; // Skip frames that exceed section frame limits
            
            const img = new Image();
            img.loaded = false;
            img.onload = () => {
                img.loaded = true;
                criticalLoadedCount++;
                updateLoaderProgress();
                if (criticalLoadedCount >= totalCritical) {
                    triggerLoadedOnce();
                }
            };
            img.onerror = () => {
                img.loaded = false;
                criticalLoadedCount++;
                updateLoaderProgress();
                if (criticalLoadedCount >= totalCritical) {
                    triggerLoadedOnce();
                }
            };
            // Files are named ezgif-frame-001.jpg through ezgif-frame-240.jpg
            const frameStr = pad(idx + 1, 3);
            img.src = `${sec.folder}/ezgif-frame-${frameStr}.jpg`;
            sec.images[idx] = img;
        });
    });
}

function updateLoaderProgress() {
    const percent = Math.min(100, Math.round((criticalLoadedCount / totalCritical) * 100));
    const loaderBar = document.getElementById("loader-bar");
    const loaderText = document.getElementById("loader-text");
    if (loaderBar) loaderBar.style.width = percent + "%";
    if (loaderText) loaderText.textContent = `LOADING EXPERIENCE... ${percent}%`;
}

// Progressive background loader queue to avoid network thread blockage
function loadBackgroundFrames() {
    let currentIdx = 0;
    const batchSize = 6; // Load 6 frames at a time across all sections
    
    function loadNextBatch() {
        if (currentIdx >= nonCriticalList.length) return;
        
        const end = Math.min(currentIdx + batchSize, nonCriticalList.length);
        
        // Count how many images will actually be requested in this batch
        let countToLoad = 0;
        for (let i = currentIdx; i < end; i++) {
            const idx = nonCriticalList[i];
            sections.forEach(sec => {
                if (idx < sec.numFrames) {
                    countToLoad++;
                }
            });
        }
        
        if (countToLoad === 0) {
            currentIdx = end;
            requestAnimationFrame(loadNextBatch);
            return;
        }
        
        let loadedInBatch = 0;
        for (let i = currentIdx; i < end; i++) {
            const idx = nonCriticalList[i];
            sections.forEach(sec => {
                if (idx >= sec.numFrames) return; // Skip frames that exceed section frame limits
                
                const img = new Image();
                img.loaded = false;
                img.onload = () => {
                    img.loaded = true;
                    loadedInBatch++;
                    if (loadedInBatch === countToLoad) {
                        currentIdx = end;
                        requestAnimationFrame(loadNextBatch);
                    }
                };
                img.onerror = () => {
                    img.loaded = false;
                    loadedInBatch++;
                    if (loadedInBatch === countToLoad) {
                        currentIdx = end;
                        requestAnimationFrame(loadNextBatch);
                    }
                };
                const frameStr = pad(idx + 1, 3);
                img.src = `${sec.folder}/ezgif-frame-${frameStr}.jpg`;
                sec.images[idx] = img;
            });
        }
    }
    
    loadNextBatch();
}

// Interpolation: Search out for the nearest loaded frame to prevent canvas blinking
function getNearestLoadedImage(images, index) {
    if (!images || images.length === 0) return null;
    
    // Clamp requested index within bounds
    const maxIdx = images.length - 1;
    const clampedIndex = Math.max(0, Math.min(index, maxIdx));
    
    if (images[clampedIndex] && images[clampedIndex].loaded) {
        return images[clampedIndex];
    }
    
    // Search outward
    let dist = 1;
    const numFramesSec = images.length;
    while (dist < numFramesSec) {
        const left = clampedIndex - dist;
        const right = clampedIndex + dist;
        if (left >= 0 && images[left] && images[left].loaded) {
            return images[left];
        }
        if (right < numFramesSec && images[right] && images[right].loaded) {
            return images[right];
        }
        dist++;
    }
    return null;
}

// Aspect ratio cover algorithm for canvas drawings
function drawSequenceImage(canvas, ctx, img) {
    if (!img || !canvas || !ctx) return;
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.naturalWidth || img.width || 1920;
    const imgHeight = img.naturalHeight || img.height || 1080;
    
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (canvasRatio > imgRatio) {
        // Canvas is wider than image
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imgRatio;
        drawX = 0;
        drawY = (canvasHeight - drawHeight) / 2;
    } else {
        // Canvas is taller than image
        drawWidth = canvasHeight * imgRatio;
        drawHeight = canvasHeight;
        drawX = (canvasWidth - drawWidth) / 2;
        drawY = 0;
    }
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

function resizeCanvases() {
    sections.forEach(sec => {
        if (!sec.canvas) return;
        
        // Match CSS client dimensions (handles high-DPI sizing adjustments smoothly)
        sec.canvas.width = window.innerWidth;
        sec.canvas.height = window.innerHeight;
        
        // Render current active frame
        const playhead = playheads[sec.name];
        const frameIndex = Math.round(playhead.frame);
        const img = getNearestLoadedImage(sec.images, frameIndex);
        if (img) {
            drawSequenceImage(sec.canvas, sec.ctx, img);
        }
    });
}

// Dynamically calculate and build the SVG path that traces around the timeline cards
function buildTimelinePath() {
    const container = document.querySelector("#experience .timeline-items");
    if (!container) return 0;

    const timelineItems = gsap.utils.toArray("#experience .timeline-item");
    if (timelineItems.length === 0) return 0;

    const containerWidth = container.offsetWidth;
    const containerScrollHeight = container.scrollHeight;
    const centerX = containerWidth / 2;

    // Update SVG dimensions to cover the full scrollable content
    const svgEl = document.querySelector("#experience .timeline-svg");
    if (svgEl) {
        svgEl.setAttribute("width", containerWidth);
        svgEl.setAttribute("height", containerScrollHeight);
        svgEl.style.height = containerScrollHeight + "px";
        svgEl.style.width = containerWidth + "px";
    }

    const r = 18; // rounded corner radius matching card border-radius
    let d = `M ${centerX} 0`; // Start at top center

    timelineItems.forEach((item) => {
        const content = item.querySelector(".timeline-content");
        if (!content) return;

        // Use offset-based positioning (relative to .timeline-items parent)
        const itemLeft = item.offsetLeft;
        const itemTop = item.offsetTop;

        // Content position relative to .timeline-items
        const contentLeft = itemLeft + content.offsetLeft;
        const contentTop = itemTop + content.offsetTop;
        const contentWidth = content.offsetWidth;
        const contentHeight = content.offsetHeight;

        const left = contentLeft;
        const right = contentLeft + contentWidth;
        const top = contentTop;
        const bottom = contentTop + contentHeight;

        const midY = top + contentHeight / 2;
        const isLeft = item.classList.contains("left");

        if (!isLeft) {
            // Card is on the RIGHT — approach from center, loop clockwise
            d += ` L ${centerX} ${midY}`;
            d += ` L ${left} ${midY}`;

            d += ` L ${left} ${top + r}`;
            d += ` A ${r} ${r} 0 0 1 ${left + r} ${top}`;
            d += ` L ${right - r} ${top}`;
            d += ` A ${r} ${r} 0 0 1 ${right} ${top + r}`;
            d += ` L ${right} ${bottom - r}`;
            d += ` A ${r} ${r} 0 0 1 ${right - r} ${bottom}`;
            d += ` L ${left + r} ${bottom}`;
            d += ` A ${r} ${r} 0 0 1 ${left} ${bottom - r}`;
            d += ` L ${left} ${midY}`;

            d += ` L ${centerX} ${midY}`;
        } else {
            // Card is on the LEFT — approach from center, loop counter-clockwise
            d += ` L ${centerX} ${midY}`;
            d += ` L ${right} ${midY}`;

            d += ` L ${right} ${top + r}`;
            d += ` A ${r} ${r} 0 0 0 ${right - r} ${top}`;
            d += ` L ${left + r} ${top}`;
            d += ` A ${r} ${r} 0 0 0 ${left} ${top + r}`;
            d += ` L ${left} ${bottom - r}`;
            d += ` A ${r} ${r} 0 0 0 ${left + r} ${bottom}`;
            d += ` L ${right - r} ${bottom}`;
            d += ` A ${r} ${r} 0 0 0 ${right} ${bottom - r}`;
            d += ` L ${right} ${midY}`;

            d += ` L ${centerX} ${midY}`;
        }
    });

    // Continue down to end of container
    d += ` L ${centerX} ${containerScrollHeight}`;

    // Update the SVG path elements
    const trackPath = document.querySelector("#experience .timeline-track-svg");
    const progressPath = document.querySelector("#experience .timeline-progress-svg");
    const beamPath = document.querySelector("#experience .timeline-beam-svg");

    if (trackPath) trackPath.setAttribute("d", d);
    if (progressPath) progressPath.setAttribute("d", d);
    if (beamPath) beamPath.setAttribute("d", d);

    // Calculate total path length
    let pathLength = 2000;
    try {
        if (trackPath) {
            pathLength = trackPath.getTotalLength();
        }
    } catch (e) {
        // fallback
    }

    return pathLength;
}

// Initialize GSAP scroll animations
function initAnimations() {
    // Capture the saved active section on initial load before any triggers override it
    const savedSectionOnLoad = sessionStorage.getItem("activeSection");

    // ------------------
    // 1. HERO SECTION TIMELINE
    // ------------------
    const heroSec = sections[0];
    const heroTimeline = gsap.timeline({
        scrollTrigger: {
            id: "hero-section",
            trigger: "#hero-section",
            start: "top top",
            end: "+=300%",
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
            refreshPriority: 5,
            onUpdate: self => {
                const frameIndex = Math.round(playheads.hero.frame);
                const img = getNearestLoadedImage(heroSec.images, frameIndex);
                drawSequenceImage(heroSec.canvas, heroSec.ctx, img);
            }
        }
    });
    
    // Animate playhead
    heroTimeline.to(playheads.hero, {
        frame: heroSec.numFrames - 1,
        ease: "none"
    }, 0);
    
    // Animate content overlays
    heroTimeline.to("#hero-section .hero-content-grid", {
        opacity: 0,
        y: -100,
        scale: 0.95,
        ease: "power1.inOut"
    }, 0);
    
    // ------------------
    // 2. ABOUT SECTION TIMELINE
    // ------------------
    const aboutSec = sections[1];
    
    // Set initial dimmed states for About Me items (fallback safe)
    gsap.set("#about-section .about-paragraph", { opacity: 0.25 });
    gsap.set("#about-section .stat-card", { opacity: 0, y: 30 });

    const aboutTimeline = gsap.timeline({
        scrollTrigger: {
            id: "about-section",
            trigger: "#about-section",
            start: "top top",
            end: "+=300%",
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
            refreshPriority: 4,
            onUpdate: self => {
                const frameIndex = Math.round(playheads.about.frame);
                const img = getNearestLoadedImage(aboutSec.images, frameIndex);
                drawSequenceImage(aboutSec.canvas, aboutSec.ctx, img);
            }
        }
    });
    
    // Animate playhead
    aboutTimeline.to(playheads.about, {
        frame: aboutSec.numFrames - 1,
        ease: "none"
    }, 0);
    
    // Fade in overlay container statically early
    aboutTimeline.fromTo("#about-section .content-overlay", 
        { opacity: 0 },
        { opacity: 1, ease: "none" },
        0
    );

    // Slide up Header tag, title and subtitle
    aboutTimeline.fromTo(["#about-section .section-tag", "#about-section .section-title", "#about-section .about-subtitle"], 
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, stagger: 0.05, ease: "power2.out" },
        0.05
    );
    
    // Line-by-line paragraph highlight reveal
    const aboutParagraphs = document.querySelectorAll("#about-section .about-paragraph");
    if (aboutParagraphs.length >= 3) {
        aboutTimeline.to(aboutParagraphs[0], { opacity: 1, color: "#ffffff" }, 0.2);
        aboutTimeline.to(aboutParagraphs[1], { opacity: 1, color: "#ffffff" }, 0.38);
        aboutTimeline.to(aboutParagraphs[2], { opacity: 1, color: "#ffffff" }, 0.56);
    }
    
    // Stagger stats cards slide-up and fade-in (revealed after text has scrolled)
    aboutTimeline.to("#about-section .stat-card", {
        opacity: 1,
        y: 0,
        stagger: 0.06,
        ease: "power2.out"
    }, 0.72);
    
    // stats cards slide-up ends the about sequence
    
    // Fade out overlay content at the very bottom
    aboutTimeline.to("#about-section .content-overlay", {
        opacity: 0,
        y: -50,
        ease: "power2.in"
    }, 0.95);

    // ------------------
    // 3. SERVICES SECTION TIMELINE
    // ------------------
    const serviceSec = sections[2];
    
    // Set initial states for Skills items (vertical scroll style)
    gsap.set("#services-section .skills-header", { opacity: 0, y: -20 });
    gsap.set("#services-section .skills-col", { opacity: 1, yPercent: 6 });
    gsap.set([
        "#services-section [data-card='2']", "#services-section [data-card='5']",
        "#services-section [data-card='3']", "#services-section [data-card='6']"
    ], { opacity: 0 });

    const serviceTimeline = gsap.timeline({
        scrollTrigger: {
            id: "services-section",
            trigger: "#services-section",
            start: "top top",
            end: "+=300%",
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
            refreshPriority: 3,
            onUpdate: self => {
                const frameIndex = Math.round(playheads.service.frame);
                const img = getNearestLoadedImage(serviceSec.images, frameIndex);
                drawSequenceImage(serviceSec.canvas, serviceSec.ctx, img);
            }
        }
    });
    
    // Animate playhead
    serviceTimeline.to(playheads.service, {
        frame: serviceSec.numFrames - 1,
        ease: "none"
    }, 0);
    
    // Reveal Skills Header at the start and keep it visible
    serviceTimeline.to("#services-section .skills-header", {
        opacity: 1,
        y: 0,
        ease: "power2.out"
    }, 0.05);

    // Fade in Cards 01 & 04 early
    serviceTimeline.fromTo(["#services-section [data-card='1']", "#services-section [data-card='4']"], 
        { opacity: 0 }, 
        { opacity: 1, ease: "power2.out" }, 
        0.05
    );

    // Scroll columns vertically from bottom to top (yPercent: 6 to yPercent: -13)
    serviceTimeline.to("#services-section .skills-col", {
        yPercent: -13,
        ease: "none"
    }, 0.12);

    // Show card pairs sequentially as columns translate upwards (fade-out is handled by CSS mask)
    serviceTimeline.to(["#services-section [data-card='2']", "#services-section [data-card='5']"], {
        opacity: 1,
        ease: "power2.out"
    }, 0.30);

    serviceTimeline.to(["#services-section [data-card='3']", "#services-section [data-card='6']"], {
        opacity: 1,
        ease: "power2.out"
    }, 0.65);
    
    // Fade out overlay content smoothly at the very end
    serviceTimeline.to("#services-section .skills-overlay", {
        opacity: 0,
        y: -50,
        ease: "power2.in"
    }, 0.95);

    // ------------------
    // 3.5. NEW SECTIONS TIMELINES & ANIMATIONS (GSAP + ScrollTrigger)
    // ------------------
    const mm = gsap.matchMedia();

    // A. Desktop Animations (min-width: 1024px)
    mm.add("(min-width: 1024px)", () => {
        
        // 1. Experience Station Journey Controller (Futuristic Train Theme)
        const experienceData = [
            {
                stationNum: "01",
                company: "Appikorn Software Consultancy",
                logoImg: "appikorn.png",
                logo: "appikorn",
                status: "PRESENT",
                role: "Full Stack Developer",
                period: "2025 - Present",
                duration: "1+ Year",
                iconClass: "fa-solid fa-briefcase",
                desc: "Building and maintaining ERP systems, AI-powered applications, and responsive web & mobile solutions.",
                responsibilities: [
                    "Developed and maintained AI-powered ERP modules",
                    "Built responsive web UI with React & Next.js",
                    "Developed cross-platform mobile apps with Flutter",
                    "Integrated REST APIs & FastAPI backend services",
                    "Optimized database queries with MongoDB"
                ],
                techStack: [
                    { name: "React", type: "purple" },
                    { name: "Next.js", type: "blue" },
                    { name: "Flutter", type: "cyan" },
                    { name: "FastAPI", type: "emerald" },
                    { name: "MongoDB", type: "green" },
                    { name: "Git", type: "gray" }
                ],
                metrics: [
                    { icon: "fa-solid fa-code", value: "10+", label: "ERP & Web Apps", glow: "purple-glow" },
                    { icon: "fa-solid fa-user-group", value: "5+", label: "Active Clients", glow: "cyan-glow" },
                    { icon: "fa-solid fa-rocket", value: "1+", label: "Years Experience", glow: "blue-glow" }
                ]
            },
            {
                stationNum: "02",
                company: "Puducherry Technological University",
                logoImg: "ptu-logo.png",
                logo: "PTU",
                status: "DEGREE",
                role: "M.Tech (Information Security)",
                period: "2023 - 2025",
                duration: "2 Years",
                iconClass: "fa-solid fa-shield-halved",
                desc: "Focused on cybersecurity, cryptography, blockchain and secure system design. Published research on post-quantum cryptography.",
                responsibilities: [
                    "Conducted research on Post-Quantum Cryptographic algorithms",
                    "Designed secure smart contract protocols on Blockchain",
                    "Built AI/ML intrusion detection & security analysis models",
                    "Implemented end-to-end encrypted communication prototypes"
                ],
                techStack: [
                    { name: "Python", type: "blue" },
                    { name: "Cryptography", type: "purple" },
                    { name: "Blockchain", type: "emerald" },
                    { name: "AI/ML", type: "cyan" },
                    { name: "PyTorch", type: "orange" },
                    { name: "Linux", type: "gray" }
                ],
                metrics: [
                    { icon: "fa-solid fa-award", value: "8.8+", label: "CGPA Grade", glow: "purple-glow" },
                    { icon: "fa-solid fa-flask", value: "2", label: "Years Research", glow: "cyan-glow" },
                    { icon: "fa-solid fa-book-bookmark", value: "1", label: "Published Paper", glow: "blue-glow" }
                ]
            },
            {
                stationNum: "03",
                company: "Christ College of Engineering and Technology",
                logoImg: "christ.png",
                logo: "CCET",
                status: "GRADUATED",
                role: "B.Tech (Computer Science and Engineering)",
                period: "2019 - 2023",
                duration: "4 Years",
                iconClass: "fa-solid fa-graduation-cap",
                desc: "Acquired strong foundational knowledge in data structures, algorithms, database management systems, and software engineering. Developed multiple academic and web-based applications.",
                responsibilities: [
                    "Built core computer science & data structure implementations",
                    "Developed full stack web applications using Java & MySQL",
                    "Led team capstone engineering projects",
                    "Maintained top academic standing across 8 semesters"
                ],
                techStack: [
                    { name: "C/C++", type: "purple" },
                    { name: "Java", type: "orange" },
                    { name: "Python", type: "blue" },
                    { name: "HTML/CSS", type: "cyan" },
                    { name: "MySQL", type: "emerald" }
                ],
                metrics: [
                    { icon: "fa-solid fa-graduation-cap", value: "8.5+", label: "CGPA Score", glow: "purple-glow" },
                    { icon: "fa-solid fa-user-graduate", value: "4", label: "Years Study", glow: "cyan-glow" },
                    { icon: "fa-solid fa-circle-check", value: "100%", label: "Course Completion", glow: "blue-glow" }
                ]
            }
        ];

        let currentStationIndex = 0;

        const updateStationView = (index, animate = true) => {
            const data = experienceData[index];
            if (!data) return;
            currentStationIndex = index;

            const renderData = () => {
                const stationNumEl = document.querySelector("#station-num-display");
                if (stationNumEl) stationNumEl.textContent = data.stationNum;

                const logoEl = document.querySelector("#exp-company-logo");
                if (logoEl) {
                    if (data.logoImg) {
                        logoEl.innerHTML = `<img src="${data.logoImg}" alt="${data.company} Logo" class="company-logo-img">`;
                    } else {
                        logoEl.innerHTML = `<span>${data.logo}</span>`;
                    }
                }

                const statusEl = document.querySelector("#exp-status");
                if (statusEl) statusEl.textContent = data.status;

                const compEl = document.querySelector("#exp-company");
                if (compEl) compEl.textContent = data.company;

                const roleEl = document.querySelector("#exp-role");
                if (roleEl) roleEl.textContent = data.role;

                const periodEl = document.querySelector("#exp-period");
                if (periodEl) periodEl.textContent = data.period;

                const durEl = document.querySelector("#exp-duration-text");
                if (durEl) durEl.textContent = data.duration;

                const descEl = document.querySelector("#exp-desc");
                if (descEl) descEl.textContent = data.desc;

                const briefEl = document.querySelector(".exp-briefcase-icon");
                if (briefEl) briefEl.innerHTML = `<i class="${data.iconClass}"></i>`;

                const respList = document.querySelector("#exp-responsibilities");
                if (respList) {
                    respList.innerHTML = data.responsibilities.map(r => `<li>${r}</li>`).join("");
                }

                const techContainer = document.querySelector("#exp-tech-tags");
                if (techContainer) {
                    techContainer.innerHTML = data.techStack.map(t => `<span class="tech-tag tag-${t.type}">${t.name}</span>`).join("");
                }

                const progressLine = document.querySelector("#station-progress-line");
                if (progressLine) {
                    progressLine.style.height = `${index * 50}%`;
                }

                const nodes = document.querySelectorAll(".station-node-btn");
                nodes.forEach((n, i) => {
                    if (i === index) n.classList.add("active");
                    else n.classList.remove("active");
                });
            };

            if (animate && document.querySelector("#exp-main-card")) {
                gsap.to("#exp-main-card", {
                    opacity: 0,
                    y: -12,
                    duration: 0.18,
                    onComplete: () => {
                        renderData();
                        gsap.to("#exp-main-card", { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" });
                    }
                });
            } else {
                renderData();
            }
        };

        // ScrollTrigger to pin and step through the 3 experience stations as user scrolls
        const expTimeline = gsap.timeline({
            scrollTrigger: {
                id: "experience",
                trigger: "#experience",
                start: "top top",
                end: "+=220%",
                scrub: 0.3,
                pin: true,
                invalidateOnRefresh: true,
                refreshPriority: 2,
                onUpdate: (self) => {
                    const prog = self.progress;
                    let targetIdx = 0;
                    if (prog < 0.33) targetIdx = 0;
                    else if (prog < 0.66) targetIdx = 1;
                    else targetIdx = 2;

                    if (targetIdx !== currentStationIndex) {
                        updateStationView(targetIdx, true);
                    }
                }
            }
        });



        // Initial setup for Station 0
        updateStationView(0, false);

        // 2. Projects Pinned Horizontal Stacking Scroll Deck
        const realProjects = gsap.utils.toArray("#projects .project-card.real-project");
        
        // Initial setup for cards stacking (absolute positioning overlays)
        gsap.set(realProjects[0], { zIndex: 10, xPercent: 0, opacity: 1, scale: 1 });
        gsap.set(realProjects[1], { zIndex: 20, xPercent: 130, opacity: 1 });
        gsap.set(realProjects[2], { zIndex: 30, xPercent: 130, opacity: 1 });
        
        // Mark first card active by default
        realProjects[0].classList.add("active-card");
        
        // Initial setup for content reveals
        realProjects.forEach((proj, idx) => {
            const title = proj.querySelector(".project-title");
            const desc = proj.querySelector(".project-desc");
            const pills = proj.querySelectorAll(".tech-pill");
            const buttons = proj.querySelectorAll(".btn-project");
            
            if (idx > 0) {
                gsap.set([title, desc, buttons], { opacity: 0, y: 20 });
                gsap.set(pills, { opacity: 0, scale: 0.8 });
            } else {
                gsap.set([title, desc, buttons], { opacity: 1, y: 0 });
                gsap.set(pills, { opacity: 1, scale: 1 });
            }
        });

        const projectsTimeline = gsap.timeline({
            scrollTrigger: {
                id: "projects",
                trigger: "#projects",
                pin: true,
                scrub: 0.5,
                start: "top top",
                end: "+=260%", // Extended scroll space for smooth pacing
                invalidateOnRefresh: true,
                refreshPriority: 1
            },
            onUpdate: function() {
                const progress = this.progress();
                let activeIndex = 0;
                if (progress < 0.35) {
                    activeIndex = 0;
                } else if (progress >= 0.35 && progress < 0.75) {
                    activeIndex = 1;
                } else {
                    activeIndex = 2;
                }
                
                const projectDots = document.querySelectorAll(".project-dot");
                projectDots.forEach((dot, idx) => {
                    if (idx === activeIndex) {
                        dot.classList.add("active");
                    } else {
                        dot.classList.remove("active");
                    }
                });

                // Update active-card class to sync hover states
                realProjects.forEach((proj, idx) => {
                    if (idx === activeIndex) {
                        proj.classList.add("active-card");
                    } else {
                        proj.classList.remove("active-card");
                        implodeCard(proj);
                        proj.dispatchEvent(new Event("mouseleave"));
                    }
                });
            }
        });
        
        // Card 1 Initial Image Parallax Zoom (Hold Card 1 from progress 0 to 0.2)
        projectsTimeline.fromTo(realProjects[0].querySelector(".project-image"),
            { scale: 1.08 },
            { scale: 1, ease: "none", duration: 0.2 },
            0
        );

        // TRANSITION 1: Card 2 slides smoothly in and overlaps Card 1 (Progress 0.2 to 0.7)
        projectsTimeline.to(realProjects[1], {
            xPercent: 0,
            ease: "power2.out",
            duration: 0.5
        }, 0.2);
        
        projectsTimeline.to(realProjects[0], {
            scale: 0.94,
            yPercent: -3,
            opacity: 0.35,
            ease: "power2.out",
            duration: 0.5
        }, 0.2);

        projectsTimeline.fromTo(realProjects[1].querySelector(".project-image"),
            { scale: 1.1 },
            { scale: 1, ease: "power1.out", duration: 0.5 },
            0.2
        );

        // Card 2 Content Reveal
        const p2Title = realProjects[1].querySelector(".project-title");
        const p2Desc = realProjects[1].querySelector(".project-desc");
        const p2Pills = realProjects[1].querySelectorAll(".tech-pill");
        const p2Buttons = realProjects[1].querySelectorAll(".btn-project");
        
        projectsTimeline.to([p2Title, p2Desc], {
            opacity: 1,
            y: 0,
            stagger: 0.06,
            duration: 0.25,
            ease: "power2.out"
        }, 0.35);
        
        projectsTimeline.to(p2Pills, {
            opacity: 1,
            scale: 1,
            stagger: 0.03,
            duration: 0.2,
            ease: "back.out(1.4)"
        }, 0.4);
        
        projectsTimeline.to(p2Buttons, {
            opacity: 1,
            y: 0,
            stagger: 0.06,
            duration: 0.2,
            ease: "power1.out"
        }, 0.45);

        // TRANSITION 2: Card 3 slides smoothly in and overlaps Card 2 (Progress 0.9 to 1.4)
        projectsTimeline.to(realProjects[2], {
            xPercent: 0,
            ease: "power2.out",
            duration: 0.5
        }, 0.9);
        
        projectsTimeline.to(realProjects[1], {
            scale: 0.94,
            yPercent: -3,
            opacity: 0.35,
            ease: "power2.out",
            duration: 0.5
        }, 0.9);
        
        projectsTimeline.to(realProjects[0], {
            scale: 0.88,
            yPercent: -6,
            opacity: 0,
            ease: "power2.out",
            duration: 0.5
        }, 0.9);

        projectsTimeline.fromTo(realProjects[2].querySelector(".project-image"),
            { scale: 1.1 },
            { scale: 1, ease: "power1.out", duration: 0.5 },
            0.9
        );

        // Card 3 Content Reveal
        const p3Title = realProjects[2].querySelector(".project-title");
        const p3Desc = realProjects[2].querySelector(".project-desc");
        const p3Pills = realProjects[2].querySelectorAll(".tech-pill");
        const p3Buttons = realProjects[2].querySelectorAll(".btn-project");
        
        projectsTimeline.to([p3Title, p3Desc], {
            opacity: 1,
            y: 0,
            stagger: 0.06,
            duration: 0.25,
            ease: "power2.out"
        }, 1.05);
        
        projectsTimeline.to(p3Pills, {
            opacity: 1,
            scale: 1,
            stagger: 0.03,
            duration: 0.2,
            ease: "back.out(1.4)"
        }, 1.1);
        
        projectsTimeline.to(p3Buttons, {
            opacity: 1,
            y: 0,
            stagger: 0.06,
            duration: 0.2,
            ease: "power1.out"
        }, 1.15);

        // Interactive project dots clicking
        const projectDots = document.querySelectorAll(".project-dot");
        projectDots.forEach((dot, idx) => {
            dot.addEventListener("click", () => {
                const trigger = ScrollTrigger.getById("projects");
                if (trigger) {
                    let targetProgress = 0;
                    if (idx === 0) targetProgress = 0;
                    else if (idx === 1) targetProgress = 0.5;
                    else if (idx === 2) targetProgress = 1.0;
                    
                    const targetScrollY = trigger.start + (trigger.end - trigger.start) * targetProgress;
                    
                    gsap.to(window, {
                        duration: 1.2,
                        scrollTo: {
                            y: targetScrollY,
                            autoKill: true
                        },
                        ease: "power2.out"
                    });
                }
            });
        });

        // 3. Merged Contact + Footer Animations (No Pinning / Scrub to prevent empty space / stuck scrolls!)
        gsap.timeline({
            scrollTrigger: {
                id: "contact",
                trigger: "#contact",
                start: "top 75%",
                toggleActions: "play none none reverse",
                refreshPriority: 0
            }
        })
        .fromTo("#contact .contact-header", 
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
        )
        .fromTo("#contact .contact-left",
            { opacity: 0, x: -50 },
            { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" },
            "-=0.6"
        )
        .fromTo("#contact .contact-right",
            { opacity: 0, x: 50 },
            { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" },
            "-=0.8"
        )
        .fromTo("#contact .premium-footer",
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
            "-=0.6"
        );
    });

    // B. Mobile Animations (max-width: 1023px)
    mm.add("(max-width: 1023px)", () => {
        // Timeline item entries on mobile
        const timelineContents = gsap.utils.toArray("#experience .timeline-content");
        timelineContents.forEach((card) => {
            gsap.fromTo(card,
                { opacity: 0, y: 30 },
                {
                    opacity: 1, y: 0, duration: 0.8, ease: "power2.out",
                    scrollTrigger: {
                        trigger: card,
                        start: "top 85%",
                        toggleActions: "play none none reverse"
                    }
                }
            );
        });

        // Project showcase card entries on mobile
        const projectCards = gsap.utils.toArray("#projects .project-card.real-project");
        projectCards.forEach((card) => {
            gsap.fromTo(card,
                { opacity: 0, y: 30 },
                {
                    opacity: 1, y: 0, duration: 0.8, ease: "power2.out",
                    scrollTrigger: {
                        trigger: card,
                        start: "top 85%",
                        toggleActions: "play none none reverse"
                    }
                }
            );
        });

        // Contact + Footer reveal on mobile
        gsap.fromTo("#contact .contact-grid",
            { opacity: 0, y: 30 },
            {
                opacity: 1, y: 0, duration: 0.8, ease: "power2.out",
                scrollTrigger: {
                    trigger: "#contact .contact-grid",
                    start: "top 85%",
                    toggleActions: "play none none reverse"
                }
            }
        );
    });

    // ------------------
    // 4. NAVIGATION SYNCHRONIZATION
    // ------------------
    const sectionIds = ["#hero-section", "#about-section", "#services-section", "#experience", "#projects", "#contact"];
    
    sectionIds.forEach(id => {
        ScrollTrigger.create({
            trigger: id,
            start: "top 40%",
            end: "bottom 40%",
            onToggle: self => {
                if (self.isActive) {
                    updateActiveNav(id.substring(1));
                }
            }
        });
    });

    // ------------------
    // 5. SECTION BRIDGE AUTO-SCROLL (DMK-style seamless transitions)
    // ------------------
    // After all ScrollTriggers are created, set up bridge auto-scroll
    // to eliminate visible gaps between pinned sections.
    // Bridges: services→experience, experience→projects, projects→contact
    
    // Wait for ScrollTrigger to compute all positions
    ScrollTrigger.refresh();

    // Small delay to ensure all triggers have computed start/end values
    setTimeout(() => {
        // Restore scroll position to the saved active section
        if (savedSectionOnLoad) {
            const trigger = ScrollTrigger.getById(savedSectionOnLoad);
            if (trigger) {
                window.scrollTo(0, trigger.start);
            } else {
                const targetEl = document.getElementById(savedSectionOnLoad);
                if (targetEl) {
                    window.scrollTo(0, targetEl.offsetTop);
                }
            }
        }
        
        // Initialize surprise cards and audio toggles
        initSurpriseCards();
        initSoundToggle();
    }, 100);
}

// ------------------
// CURSOR-FOLLOWING GLOW & PARALLAX IN PROJECTS SECTION
// ------------------
const projectsSec = document.getElementById("projects");
const cursorGlow = document.querySelector(".cursor-glow");

if (projectsSec) {
    projectsSec.addEventListener("mousemove", e => {
        if (cursorGlow) {
            const rect = projectsSec.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            gsap.to(cursorGlow, {
                x: x,
                y: y,
                opacity: 1,
                duration: 0.6,
                ease: "power2.out"
            });
        }
        
        // Subtle card-image parallax relative to screen center on desktop
        if (window.innerWidth >= 1024) {
            const moveX = (e.clientX - window.innerWidth / 2) * 0.015;
            const moveY = (e.clientY - window.innerHeight / 2) * 0.015;
            
            gsap.to("#projects .project-image", {
                x: moveX,
                y: moveY,
                duration: 0.8,
                ease: "power2.out"
            });
            gsap.to("#projects .project-card-inner", {
                x: -moveX * 0.5,
                y: -moveY * 0.5,
                duration: 0.8,
                ease: "power2.out"
            });
        }
    });
    
    projectsSec.addEventListener("mouseleave", () => {
        if (cursorGlow) {
            gsap.to(cursorGlow, {
                opacity: 0,
                duration: 0.6
            });
        }
        
        // Reset image positions
        gsap.to(["#projects .project-image", "#projects .project-card-inner"], {
            x: 0,
            y: 0,
            duration: 0.8,
            ease: "power2.out"
        });
    });
}

// Active indicator toggles
function updateActiveNav(activeId) {
    // 1. Sidebar dots
    document.querySelectorAll(".side-dot").forEach(dot => {
        if (dot.getAttribute("data-target") === activeId) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });
    
    // 2. Navigation items
    document.querySelectorAll(".nav-item").forEach(item => {
        const hrefId = item.getAttribute("href").substring(1);
        if (hrefId === activeId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    // Save current active section state to sessionStorage
    sessionStorage.setItem("activeSection", activeId);
}

// Smooth scrolling for navigation clicks (using ScrollToPlugin) and hash prevention
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", e => {
        const targetId = link.getAttribute("href");
        if (targetId && targetId.startsWith("#")) {
            e.preventDefault();
            const targetEl = document.querySelector(targetId);
            
            if (targetEl) {
                // Find ScrollTrigger for this section to scroll to its exact start scroll coordinate
                const sectionName = targetId.substring(1);
                const trigger = ScrollTrigger.getById(sectionName);
                const targetY = trigger ? trigger.start : targetEl.offsetTop;

                gsap.to(window, {
                    duration: 1.6,
                    scrollTo: {
                        y: targetY,
                        autoKill: true
                    },
                    ease: "power3.inOut"
                });
            }
        }
    });
});

// Clean hash from URL bar to keep URL pretty
const cleanUrlHash = () => {
    if (window.location.hash) {
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
    }
};
window.addEventListener("load", cleanUrlHash);
window.addEventListener("hashchange", cleanUrlHash);

// Windows resize bindings
window.addEventListener("resize", resizeCanvases);

// ------------------
// CONTACT FORM SUBMISSION (Web3Forms)
// ------------------
const form = document.getElementById('form');
if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rawFormData = new FormData(form);
        const visitorName = rawFormData.get("name");
        const visitorEmail = rawFormData.get("email");
        const visitorSubject = rawFormData.get("subject");
        const visitorMessage = rawFormData.get("message");

        // Rebuild FormData in the exact desired visual order for the Web3Forms email body
        const formData = new FormData();
        formData.append("access_key", "5cb72137-f2d4-4fc0-a19c-079fa287f0d3");
        formData.append("from_name", "Portfolio Contact Form");
        formData.append("subject", `[Portfolio Message] "${visitorSubject}" by ${visitorName}`);
        
        // Form body fields in precise sequence
        formData.append("Name", visitorName);
        formData.append("Email", visitorEmail);
        formData.append("Message Subject", visitorSubject);
        formData.append("Message", visitorMessage);
        formData.append("Sent From", "Immanuvel's Portfolio Website");
        
        if (visitorEmail) {
            formData.append("replyto", visitorEmail);
        }

        const originalText = submitBtn.textContent;

        submitBtn.textContent = "Sending...";
        submitBtn.disabled = true;

        try {
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showToast("Success", "Your message has been sent successfully!", "success");
                form.reset();
            } else {
                showToast("Error", data.message || "Failed to send message.", "error");
            }

        } catch (error) {
            showToast("Error", "Something went wrong. Please try again.", "error");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// ------------------
// TOAST NOTIFICATIONS UTILITY
// ------------------
function showToast(title, message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;

    const iconClass = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${iconClass}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close-btn">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    // Trigger reflow to enable transition
    toast.offsetHeight;

    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto-remove toast after 4 seconds
    const autoRemoveTimer = setTimeout(() => {
        removeToast(toast);
    }, 4000);

    // Close button click listener
    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
        clearTimeout(autoRemoveTimer);
        removeToast(toast);
    });
}

function removeToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => {
        toast.remove();
        // Remove container if empty
        const container = document.querySelector('.toast-container');
        if (container && container.childNodes.length === 0) {
            container.remove();
        }
    });
}

// Initialize image loader execution
initLoading();

// ==============================================================
// SURPRISE BOX CARD & EXPLOSION EFFECTS
// ==============================================================

let audioCtx = null;
window.portfolioAudioEnabled = true;

function playTactileSound(type) {
    if (!window.portfolioAudioEnabled) return;
    
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        
        if (type === "burst") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
            
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === "click") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            
            osc.start(now);
            osc.stop(now + 0.05);
        }
    } catch (e) {
        console.warn("Audio Context playback failed:", e);
    }
}

function initSoundToggle() {
    const btn = document.getElementById("sound-toggle-btn");
    if (!btn) return;
    
    btn.addEventListener("click", () => {
        window.portfolioAudioEnabled = !window.portfolioAudioEnabled;
        if (window.portfolioAudioEnabled) {
            btn.classList.remove("muted");
            btn.innerHTML = `<i class="fa-solid fa-volume-high"></i>`;
            playTactileSound("click");
        } else {
            btn.classList.add("muted");
            btn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i>`;
        }
    });
}

function explodeCard(card) {
    const badgesContainer = card.querySelector(".tech-badges-container");
    if (!badgesContainer) return;
    const badgeItems = badgesContainer.querySelectorAll(".tech-badge-item");
    const svg = card.querySelector(".project-lasers");
    
    badgeItems.forEach((badge) => {
        const id = badge.getAttribute("data-id");
        const dx = parseFloat(badge.getAttribute("data-x"));
        const dy = parseFloat(badge.getAttribute("data-y"));
        const delay = parseFloat(badge.getAttribute("data-delay"));
        
        gsap.to(badge, {
            x: dx,
            y: dy,
            xPercent: -50,
            yPercent: -50,
            scale: 1,
            opacity: 1,
            rotate: 0,
            duration: 0.5,
            delay: delay,
            ease: "back.out(1.4)"
        });
        
        if (svg) {
            const guide = svg.querySelector(`.laser-guide[data-id="${id}"]`);
            const line = svg.querySelector(`.laser-line[data-id="${id}"]`);
            
            if (guide && line) {
                gsap.to(guide, {
                    opacity: 1,
                    duration: 0.35,
                    delay: delay
                });
                
                const endX = parseFloat(guide.getAttribute("x2"));
                const endY = parseFloat(guide.getAttribute("y2"));
                
                gsap.to(line, {
                    attr: { x2: endX, y2: endY },
                    opacity: 1,
                    duration: 0.4,
                    delay: delay,
                    ease: "power2.out"
                });
            }
        }
    });
}

function implodeCard(card) {
    const badgesContainer = card.querySelector(".tech-badges-container");
    if (!badgesContainer) return;
    const badgeItems = badgesContainer.querySelectorAll(".tech-badge-item");
    const svg = card.querySelector(".project-lasers");
    
    badgeItems.forEach((badge) => {
        const id = badge.getAttribute("data-id");
        const rotate = parseFloat(badge.getAttribute("data-rotate")) || 0;
        
        gsap.to(badge, {
            x: 0,
            y: 0,
            xPercent: -50,
            yPercent: -50,
            scale: 0,
            opacity: 0,
            rotate: rotate,
            duration: 0.35,
            ease: "power2.in"
        });
        
        if (svg) {
            const guide = svg.querySelector(`.laser-guide[data-id="${id}"]`);
            const line = svg.querySelector(`.laser-line[data-id="${id}"]`);
            
            if (guide && line) {
                gsap.to(guide, {
                    opacity: 0,
                    duration: 0.25
                });
                
                const startX = parseFloat(line.getAttribute("x1"));
                const startY = parseFloat(line.getAttribute("y1"));
                
                gsap.to(line, {
                    attr: { x2: startX, y2: startY },
                    opacity: 0,
                    duration: 0.3,
                    ease: "power2.in"
                });
            }
        }
    });
}

function initSurpriseCards() {
    const cards = document.querySelectorAll(".project-card.real-project");
    cards.forEach(card => {
        let svg = card.querySelector(".project-lasers");
        if (!svg) {
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "project-lasers");
            svg.setAttribute("viewBox", "-600 -450 1200 900");
            card.insertBefore(svg, card.firstChild);
        } else {
            svg.setAttribute("viewBox", "-600 -450 1200 900");
        }
        
        let orbits = svg.querySelector(".orbital-tracks");
        if (!orbits) {
            orbits = document.createElementNS("http://www.w3.org/2000/svg", "g");
            orbits.setAttribute("class", "orbital-tracks");
            orbits.innerHTML = `
                <ellipse cx="0" cy="0" rx="520" ry="320" fill="none" stroke="rgba(168, 85, 247, 0.08)" stroke-width="1.5" stroke-dasharray="6, 6" />
                <ellipse cx="0" cy="0" rx="440" ry="260" fill="none" stroke="rgba(6, 182, 212, 0.06)" stroke-width="1.5" stroke-dasharray="4, 8" />
                <ellipse cx="0" cy="0" rx="570" ry="380" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" stroke-dasharray="8, 4" />
            `;
            svg.appendChild(orbits);
        } else {
            orbits.innerHTML = `
                <ellipse cx="0" cy="0" rx="520" ry="320" fill="none" stroke="rgba(168, 85, 247, 0.08)" stroke-width="1.5" stroke-dasharray="6, 6" />
                <ellipse cx="0" cy="0" rx="440" ry="260" fill="none" stroke="rgba(6, 182, 212, 0.06)" stroke-width="1.5" stroke-dasharray="4, 8" />
                <ellipse cx="0" cy="0" rx="570" ry="380" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" stroke-dasharray="8, 4" />
            `;
        }
        
        let defs = svg.querySelector("defs");
        if (!defs) {
            defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            svg.appendChild(defs);
        }
        
        const badgesContainer = card.querySelector(".tech-badges-container");
        if (!badgesContainer) return;
        
        const badgeItems = badgesContainer.querySelectorAll(".tech-badge-item");
        
        badgeItems.forEach((badge) => {
            const id = badge.getAttribute("data-id");
            const name = badge.getAttribute("data-name");
            const color = badge.getAttribute("data-color") || "#A855F7";
            const iconClass = badge.getAttribute("data-icon") || "fa-solid fa-code";
            const dx = parseFloat(badge.getAttribute("data-x"));
            const dy = parseFloat(badge.getAttribute("data-y"));
            
            badge.innerHTML = `
                <div class="tech-badge-pill" style="border: 1px solid ${color}90; box-shadow: 0 0 14px -2px ${color}60, inset 0 0 8px -2px ${color}40;">
                    <i class="${iconClass}" style="color: ${color};"></i>
                    <span>${name}</span>
                </div>
            `;
            // Only draw laser arrows for left/right side badges (Math.abs(dx) >= 400)
            const isSideBadge = Math.abs(dx) >= 400;
            if (!isSideBadge) return;
            
            const cardHalfW = 400;
            const cardHalfH = 190;
            const dist = Math.hypot(dx, dy);
            
            let tEdge = 0;
            if (dx !== 0 || dy !== 0) {
                const tx = dx !== 0 ? cardHalfW / Math.abs(dx) : Infinity;
                const ty = dy !== 0 ? cardHalfH / Math.abs(dy) : Infinity;
                tEdge = Math.min(tx, ty, 1);
            }
            
            const badgeOffset = 36;
            const tEnd = dist > badgeOffset ? 1 - badgeOffset / dist : 1;
            
            const startX = dx * tEdge;
            const startY = dy * tEdge;
            const endX = dx * tEnd;
            const endY = dy * tEnd;
            
            const gradientId = `grad-${card.id}-${id}`;
            const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
            grad.setAttribute("id", gradientId);
            grad.setAttribute("gradientUnits", "userSpaceOnUse");
            grad.setAttribute("x1", startX);
            grad.setAttribute("y1", startY);
            grad.setAttribute("x2", endX);
            grad.setAttribute("y2", endY);
            
            grad.innerHTML = `
                <stop offset="0%" stop-color="#A855F7" stop-opacity="0.2" />
                <stop offset="60%" stop-color="${color}" stop-opacity="0.8" />
                <stop offset="100%" stop-color="${color}" stop-opacity="1" />
            `;
            defs.appendChild(grad);
            
            const markerId = `arrow-${card.id}-${id}`;
            const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
            marker.setAttribute("id", markerId);
            marker.setAttribute("viewBox", "0 0 10 10");
            marker.setAttribute("refX", "8");
            marker.setAttribute("refY", "5");
            marker.setAttribute("markerWidth", "6");
            marker.setAttribute("markerHeight", "6");
            marker.setAttribute("orient", "auto-start-reverse");
            
            marker.innerHTML = `<path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${color}" />`;
            defs.appendChild(marker);
            
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "laser-line");
            line.setAttribute("data-id", id);
            line.setAttribute("x1", startX);
            line.setAttribute("y1", startY);
            line.setAttribute("x2", startX);
            line.setAttribute("y2", startY);
            line.setAttribute("stroke", `url(#${gradientId})`);
            line.setAttribute("stroke-width", "1.5");
            line.setAttribute("marker-end", `url(#${markerId})`);
            line.setAttribute("opacity", "0");
            svg.appendChild(line);
            
            const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
            guide.setAttribute("class", "laser-guide");
            guide.setAttribute("data-id", id);
            guide.setAttribute("x1", startX);
            guide.setAttribute("y1", startY);
            guide.setAttribute("x2", endX);
            guide.setAttribute("y2", endY);
            guide.setAttribute("stroke", color);
            guide.setAttribute("stroke-width", "2.5");
            guide.setAttribute("stroke-opacity", "0.15");
            guide.setAttribute("stroke-dasharray", "4 4");
            guide.setAttribute("opacity", "0");
            svg.insertBefore(guide, line);
        });
        
        const cardInner = card.querySelector(".project-card-inner");
        
        card.addEventListener("mouseenter", () => {
            if (!card.classList.contains("active-card")) return;
            
            card.classList.add("active-hover");
            
            gsap.to(cardInner, {
                y: -6,
                scale: 1.02,
                rotateX: 2,
                rotateY: -1,
                duration: 0.4,
                ease: "power2.out"
            });
            
            explodeCard(card);
            playTactileSound("burst");
        });
        
        card.addEventListener("mouseleave", () => {
            card.classList.remove("active-hover");
            
            gsap.to(cardInner, {
                y: 0,
                scale: 1,
                rotateX: 0,
                rotateY: 0,
                duration: 0.4,
                ease: "power2.out"
            });
            
            implodeCard(card);
            
            const subtitleEl = card.querySelector(".project-desc");
            const originalDesc = card.getAttribute("data-original-desc");
            if (subtitleEl && originalDesc) {
                subtitleEl.innerHTML = originalDesc;
                subtitleEl.classList.remove("hovered-tech-highlight");
            }
        });
        
        const originalDesc = card.querySelector(".project-desc").innerHTML;
        card.setAttribute("data-original-desc", originalDesc);
        
        badgeItems.forEach((badge) => {
            const name = badge.getAttribute("data-name");
            const color = badge.getAttribute("data-color");
            const pill = badge.querySelector(".tech-badge-pill");
            if (pill) {
                pill.addEventListener("mouseenter", () => {
                    const subtitleEl = card.querySelector(".project-desc");
                    if (subtitleEl) {
                        subtitleEl.innerHTML = `<span style="color: ${color}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--font-heading);">Tech: ${name}</span>`;
                        subtitleEl.classList.add("hovered-tech-highlight");
                    }
                });
                pill.addEventListener("mouseleave", () => {
                    const subtitleEl = card.querySelector(".project-desc");
                    if (subtitleEl) {
                        subtitleEl.innerHTML = originalDesc;
                        subtitleEl.classList.remove("hovered-tech-highlight");
                    }
                });
            }
        });
    });
}
