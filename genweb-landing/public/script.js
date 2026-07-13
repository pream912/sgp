// Initialize GSAP
gsap.registerPlugin(ScrollTrigger);

// Hero Animation Timeline
const initHeroAnimations = () => {
    const tl = gsap.timeline();

    // Initial Reveal
    tl.from(".hero-content > *", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out"
    })
    .from(".hero-visual", {
        x: 30,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
    }, "-=0.6");

    // "Typing" Effect Simulation
    const typedTextSpan = document.getElementById("typed-text");
    const phrases = ["Website for a Clinic", "Website for a Shop", "Website for a Cafe", "Website for a School"];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    const type = () => {
        const currentPhrase = phrases[phraseIndex];
        
        if (isDeleting) {
            typedTextSpan.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typedTextSpan.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
        }

        if (!isDeleting && charIndex === currentPhrase.length) {
            isDeleting = true;
            setTimeout(type, 2000); // Pause at end
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            setTimeout(type, 500); // Pause before new word
        } else {
            const speed = isDeleting ? 50 : 100;
            setTimeout(type, speed);
        }
    };

    setTimeout(type, 1000);

    // 3D Tilt Effect for Hero Image
    const heroVisual = document.querySelector('.hero-visual');
    const heroCard = document.querySelector('.hero-card');

    if (heroVisual && heroCard) {
        heroVisual.addEventListener('mousemove', (e) => {
            const rect = heroVisual.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -10; // Max -10 to 10 deg
            const rotateY = ((x - centerX) / centerX) * 10;

            gsap.to(heroCard, {
                duration: 0.5,
                rotateX: rotateX,
                rotateY: rotateY,
                transformPerspective: 1000,
                ease: "power1.out"
            });
        });

        heroVisual.addEventListener('mouseleave', () => {
            gsap.to(heroCard, {
                duration: 1,
                rotateX: 0,
                rotateY: 0,
                ease: "elastic.out(1, 0.3)"
            });
        });
    }
};

// Scroll Trigger Animations
const initScrollAnimations = () => {
    // Features Stagger
    gsap.utils.toArray('.feature-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            y: 50,
            opacity: 0,
            duration: 0.6,
            delay: i * 0.1
        });
    });

    // Section Titles
    gsap.utils.toArray('.section-title').forEach(title => {
        gsap.from(title, {
            scrollTrigger: {
                trigger: title,
                start: "top 80%",
            },
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: "power2.out"
        });
    });

    // Comparison Table Rows
    gsap.utils.toArray('.comparison-row').forEach((row, i) => {
        gsap.from(row, {
            scrollTrigger: {
                trigger: ".comparison-table",
                start: "top 70%"
            },
            x: -20,
            opacity: 0,
            duration: 0.5,
            delay: i * 0.1,
            ease: "power1.out"
        });
    });
};

// Navbar Scroll Effect
const initNavbar = () => {
    const navbar = document.querySelector('nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            navbar.classList.add('shadow-md', 'bg-white/95');
            navbar.classList.remove('bg-white/0');
        } else {
            navbar.classList.remove('shadow-md', 'bg-white/95');
            navbar.classList.add('bg-white/0');
        }
    });
};

// Initialize All
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initHeroAnimations();
    initScrollAnimations();
});
