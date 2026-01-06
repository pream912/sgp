import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Menu, X, Phone, Mail, MapPin, Clock, Camera, User, Package, Briefcase,
    Facebook, Instagram, Twitter, Linkedin, Star
} from 'lucide-react';

// Design System and User Context Data
const designSystem = {"businessName":"JPR STUDIO","colorPalette":{"primary":"#A51C30","secondary":"#0D3C5E","accent":"#D4D9E2","background":"#1A1A1A","text":"#F0F0F0","buttonBackground":"#A51C30","buttonText":"#F0F0F0"},"typography":{"fontFamily":"Montserrat, sans-serif","scale":"1.25"},"googleFonts":{"heading":"Montserrat","body":"Open Sans"},"vibe":"Sophisticated, Modern, Dynamic, Premium, Trustworthy","layoutStructure":"Visual-centric, responsive grid layout with clear navigation and focus on showcasing photography work.","heroStyle":"Centered Text with Large Background Image","headerStyle":"Simple Logo Left, Links Right","footerStyle":"Multi-Column Links","imageKeywords":["professional photography","photography studio","camera lens","photoshoot experience","portrait session"],"imageUrls":["https://images.unsplash.com/photo-1506862265142-6821b7b8df2f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTMzNXwwfDF8c2VhcmNofDEzfHxwcm9mZXNzaW9uYWwlMjBwaG90b2dyYXBoeXxlbnwwfHx8fDE3MTcwMDY1Mjl8MA&ixlib=rb-4.0.3&q=80&w=1080","https://images.unsplash.com/photo-1510936111840-65e496466e95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTMzNXwwfDF8c2VhcmNofDR8fHBob3RvZ3JhcGh5JTIwc3R1ZGlvfGVufDB8fHx8MTcxNzAwNjUyOXww&ixlib=rb-4.0.3&q=80&w=1080","https://images.unsplash.com/photo-1516035069371-87d89697ad92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTMzNXwwfDF8c2VhcmNofDV8fGNhbWVyYSUyMGxlbnN8ZW58MHx8fHwxNzE3MDA2NTI5fDA&ixlib=rb-4.0.3&q=80&w=1080","https://images.unsplash.com/photo-1520390138845-fd2d229dd553?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTMzNXwwfDF8c2VhcmNofDEwfHxwaG90b2dyYXBoeSUyMHN0dWRpb3xlbnwwfHx8fDE3MTcwMDY1Mjl8MA&ixlib=rb-4.0.3&q=80&w=1080","https://images.unsplash.com/photo-1526365103444-1250325d7b32?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTMzNXwwfDF8c2VhcmNofDE3fHxwcm9mZXNzaW9uYWwlMjBwaG90b2dyYXBoeXxlbnwwfHx8fDE3MTcwMDY1Mjl8MA&ixlib=rb-4.0.3&q=80&w=1080","https://images.unsplash.com/photo-1516035069371-87d89697ad92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTMzNXwwfDF8c2VhcmNofDV8fGNhbWVyYSUyMGxlbnN8ZW58MHx8fHwxNzE3MDA2NTI5fDA&ixlib=rb-4.0.3&q=80&w=1080","https://images.unsplash.com/photo-1510936111840-65e496466e95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTMzNXwwfDF8c2VhcmNofDR8fHBob3RvZ3JhcGh5JTIwc3R1ZGlvfGVufDB8fHx8MTcxNzAwNjUyOXww&ixlib=rb-4.0.3&q=80&w=1080"],"logoUrl":""};
const userContext = {"hero":{"title":"Capturing Your Moments, Crafting Your Story","subtitle":"JPR STUDIO: Where every click tells a tale.","ctaText":"View Our Portfolio","ctaLink":"#portfolio"},"about":{"title":"About JPR STUDIO","content":"At JPR STUDIO, we believe in the power of a single image to convey emotion, tell a story, and preserve a moment in time. With years of experience and a passion for visual artistry, we specialize in creating stunning photographs that exceed expectations. Our approach is collaborative, ensuring your vision is brought to life with creativity and precision. From intimate portraits to grand events, we are dedicated to providing a seamless and enjoyable photography experience, resulting in timeless images you'll cherish forever.","imageUrl":"https://images.unsplash.com/photo-1520390138845-fd2d229dd553?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NTMzNXwwfDF8c2VhcmNofDEwfHxwaG90b2dyYXBoeSUyMHN0dWRpb3xlbnwwfHx8fDE3MTcwMDY1Mjl8MA&ixlib=rb-4.0.3&q=80&w=1080"},"services":{"title":"Our Photography Services","items":[{"name":"Portrait Photography","description":"Capture your true self with our personalized portrait sessions.","icon":"User"},{"name":"Event Photography","description":"Preserve the memories of your special occasions.","icon":"Camera"},{"name":"Commercial Photography","description":"Elevate your brand with professional imagery.","icon":"Briefcase"},{"name":"Product Photography","description":"Showcase your products in their best light.","icon":"Package"}]},"reviews":[{"author":"Alice Johnson","quote":"JPR STUDIO made my wedding day unforgettable! The photos are absolutely breathtaking. Highly recommend!","rating":5},{"author":"Mark Davis","quote":"Professional, creative, and a joy to work with. Our family portraits turned out amazing.","rating":5},{"author":"Sarah Lee","quote":"The commercial shoot for my business was flawless. JPR STUDIO truly understood my brand vision.","rating":4}],"contactDetails":{"address":"123 Photo Lane, Art City, AC 12345","phone":"+1 (555) 123-4567","email":"info@jprstudio.com"},"openingHours":[{"day":"Monday","hours":"9:00 AM - 6:00 PM"},{"day":"Tuesday","hours":"9:00 AM - 6:00 PM"},{"day":"Wednesday","hours":"9:00 AM - 6:00 PM"},{"day":"Thursday","hours":"9:00 AM - 6:00 PM"},{"day":"Friday","hours":"9:00 AM - 4:00 PM"},{"day":"Saturday","hours":"10:00 AM - 2:00 PM"},{"day":"Sunday","hours":"Closed"}]};

const { businessName, colorPalette, typography, googleFonts, heroStyle, headerStyle, footerStyle, imageUrls } = designSystem;
const { primary, secondary, accent, background, text, buttonBackground, buttonText } = colorPalette;

// Helper to get icon component by name
const getIcon = (iconName) => {
    const icons = { User, Camera, Package, Briefcase };
    return icons[iconName] || Camera; // Default to Camera if not found
};

// Helper to cycle through images
let imageIndex = 0;
const getNextImage = () => {
    const url = imageUrls[imageIndex % imageUrls.length];
    imageIndex++;
    return url;
};

// Helper to generate star ratings
const StarRating = ({ rating }) => (
    <div className="flex">
        {[...Array(5)].map((_, i) => (
            <Star
                key={i}
                className={`w-4 h-4 ${i < rating ? 'text-accent' : 'text-gray-500'}`}
                fill={i < rating ? colorPalette.accent : 'none'}
            />
        ))}
    </div>
);

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        document.documentElement.style.setProperty('--font-heading', `${googleFonts.heading}, ${typography.fontFamily}`);
        document.documentElement.style.setProperty('--font-body', `${googleFonts.body}, ${typography.fontFamily}`);
    }, [googleFonts, typography]);

    const navLinks = [
        { name: 'Home', href: '#hero' },
        { name: 'About', href: '#about' },
        { name: 'Services', href: '#services' },
        { name: 'Portfolio', href: '#portfolio' },
        { name: 'Testimonials', href: '#testimonials' },
        { name: 'Contact', href: '#contact' },
    ];

    const renderLogo = () => {
        if (designSystem.logoUrl) {
            return <img src={designSystem.logoUrl} alt={`${businessName} Logo`} className="h-10 w-auto" />;
        }
        return <span className="font-heading text-2xl font-bold text-text">{businessName}</span>;
    };

    const Header = () => {
        const baseClasses = `w-full z-50 transition-all duration-300 ${headerStyle === 'Transparent Overlay Header' ? 'absolute top-0' : 'relative bg-background shadow-md'}`;
        const navClasses = "hidden md:flex space-x-6";
        const mobileMenuClasses = "md:hidden flex items-center";

        return (
            <motion.header
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className={`${baseClasses} ${headerStyle === 'Floating Pill' ? 'fixed top-4 left-1/2 -translate-x-1/2 rounded-full px-8 py-3 bg-secondary/90 backdrop-blur-sm' : 'px-4 py-4'}`}
            >
                <nav className="container mx-auto flex justify-between items-center">
                    {renderLogo()}
                    <div className={navClasses}>
                        {navLinks.map((link) => (
                            <a key={link.name} href={link.href} className="font-body text-text hover:text-primary transition-colors duration-300">
                                {link.name}
                            </a>
                        ))}
                    </div>
                    <div className={mobileMenuClasses}>
                        <button onClick={() => setIsSidebarOpen(true)} className="text-text">
                            <Menu size={24} />
                        </button>
                    </div>
                </nav>

                <AnimatePresence>
                    {isSidebarOpen && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                            className="fixed inset-y-0 right-0 w-64 bg-secondary text-text p-6 shadow-lg md:hidden z-[100]"
                        >
                            <div className="flex justify-between items-center mb-8">
                                {renderLogo()}
                                <button onClick={() => setIsSidebarOpen(false)} className="text-text">
                                    <X size={24} />
                                </button>
                            </div>
                            <nav className="flex flex-col space-y-4">
                                {navLinks.map((link) => (
                                    <a
                                        key={link.name}
                                        href={link.href}
                                        onClick={() => setIsSidebarOpen(false)}
                                        className="font-body text-lg text-text hover:text-primary transition-colors duration-300"
                                    >
                                        {link.name}
                                    </a>
                                ))}
                            </nav>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>
        );
    };

    const Hero = () => {
        const heroImage = getNextImage();
        let contentClasses = "relative z-10 text-center text-text";
        let heroContainerClasses = "relative h-screen flex items-center justify-center bg-cover bg-center";

        if (heroStyle === 'Centered Text with Large Background Image') {
            heroContainerClasses += ''; // Already set up for this
        } else if (heroStyle === 'Left Aligned Text with Image') {
            heroContainerClasses = "relative h-screen flex items-center bg-cover bg-center";
            contentClasses = "relative z-10 text-left text-text max-w-2xl mx-auto md:ml-20";
        } else if (heroStyle === 'Minimalist with Subtle Animation') {
            heroContainerClasses += ' overflow-hidden';
            contentClasses = "relative z-10 text-center text-text";
        }

        return (
            <section data-section="hero" className={heroContainerClasses} style={{ backgroundImage: `url(${heroImage})` }}>
                <div className="absolute inset-0 bg-black/60"></div> {/* Dark overlay */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className={contentClasses}
                >
                    <h1 className="font-heading text-5xl md:text-7xl font-extrabold mb-4 drop-shadow-lg">
                        {userContext.hero.title}
                    </h1>
                    <p className="font-body text-xl md:text-2xl mb-8 max-w-3xl mx-auto drop-shadow-lg">
                        {userContext.hero.subtitle}
                    </p>
                    <motion.a
                        href={userContext.hero.ctaLink}
                        className="inline-block px-8 py-4 rounded-full font-body text-lg font-semibold"
                        style={{ backgroundColor: buttonBackground, color: buttonText }}
                        whileHover={{ scale: 1.05, boxShadow: `0 0 20px ${primary}` }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {userContext.hero.ctaText}
                    </motion.a>
                </motion.div>
            </section>
        );
    };

    const About = () => (
        <section data-section="about" className="py-16 md:py-24 bg-background text-text">
            <div className="container mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.6 }}
                    className="grid md:grid-cols-2 gap-12 items-center"
                >
                    <div className="order-2 md:order-1">
                        <h2 className="font-heading text-4xl md:text-5xl font-bold mb-6 text-primary">
                            {userContext.about.title}
                        </h2>
                        <p className="font-body text-lg leading-relaxed mb-6">
                            {userContext.about.content}
                        </p>
                        <motion.a
                            href="#contact"
                            className="inline-block px-8 py-4 rounded-full font-body text-lg font-semibold"
                            style={{ backgroundColor: buttonBackground, color: buttonText }}
                            whileHover={{ scale: 1.05, boxShadow: `0 0 20px ${primary}` }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Get in Touch
                        </motion.a>
                    </div>
                    <div className="order-1 md:order-2">
                        <motion.img
                            src={userContext.about.imageUrl || getNextImage()}
                            alt="About JPR STUDIO"
                            className="w-full h-96 object-cover rounded-lg shadow-xl"
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        />
                    </div>
                </motion.div>
            </div>
        </section>
    );

    const Services = () => (
        <section data-section="services" className="py-16 md:py-24 bg-secondary text-text">
            <div className="container mx-auto px-4 text-center">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.6 }}
                    className="font-heading text-4xl md:text-5xl font-bold mb-12 text-primary"
                >
                    {userContext.services.title}
                </motion.h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {userContext.services.items.map((service, index) => {
                        const Icon = getIcon(service.icon);
                        return (
                            <motion.div
                                key={index}
                                className="bg-background p-8 rounded-lg shadow-lg flex flex-col items-center text-center"
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                whileHover={{ scale: 1.05, boxShadow: `0 0 25px ${primary}` }}
                            >
                                <Icon className="w-16 h-16 text-accent mb-4" />
                                <h3 className="font-heading text-2xl font-semibold mb-3 text-text">
                                    {service.name}
                                </h3>
                                <p className="font-body text-base text-gray-300">
                                    {service.description}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );

    const Portfolio = () => (
        <section data-section="portfolio" className="py-16 md:py-24 bg-background text-text">
            <div className="container mx-auto px-4 text-center">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.6 }}
                    className="font-heading text-4xl md:text-5xl font-bold mb-12 text-primary"
                >
                    Our Portfolio
                </motion.h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {imageUrls.slice(0, 6).map((url, index) => ( // Display first 6 images from imageUrls
                        <motion.div
                            key={index}
                            className="relative overflow-hidden rounded-lg shadow-lg group"
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{ scale: 1.03 }}
                        >
                            <img
                                src={url}
                                alt={`Portfolio item ${index + 1}`}
                                className="w-full h-72 object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <p className="font-heading text-xl text-text">View Project</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );

    const Testimonials = () => (
        <section data-section="testimonials" className="py-16 md:py-24 bg-secondary text-text">
            <div className="container mx-auto px-4 text-center">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.6 }}
                    className="font-heading text-4xl md:text-5xl font-bold mb-12 text-primary"
                >
                    What Our Clients Say
                </motion.h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {userContext.reviews && userContext.reviews.map((review, index) => (
                        <motion.div
                            key={index}
                            className="bg-background p-8 rounded-lg shadow-lg flex flex-col items-center text-center"
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                        >
                            <StarRating rating={review.rating} />
                            <p className="font-body text-lg italic my-4 text-gray-300">
                                "{review.quote}"
                            </p>
                            <p className="font-heading text-xl font-semibold text-text">
                                - {review.author}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );

    const Contact = () => (
        <section data-section="contact" className="py-16 md:py-24 bg-background text-text">
            <div className="container mx-auto px-4">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.6 }}
                    className="font-heading text-4xl md:text-5xl font-bold mb-12 text-center text-primary"
                >
                    Get in Touch
                </motion.h2>
                <div className="grid md:grid-cols-2 gap-12 items-start">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.6 }}
                        className="bg-secondary p-8 rounded-lg shadow-lg"
                    >
                        <h3 className="font-heading text-3xl font-semibold mb-6 text-text">Contact Information</h3>
                        {userContext.contactDetails && (
                            <div className="space-y-4 font-body text-lg">
                                <p className="flex items-center text-gray-300">
                                    <MapPin className="w-6 h-6 text-accent mr-3" />
                                    {userContext.contactDetails.address}
                                </p>
                                <p className="flex items-center text-gray-300">
                                    <Phone className="w-6 h-6 text-accent mr-3" />
                                    {userContext.contactDetails.phone}
                                </p>
                                <p className="flex items-center text-gray-300">
                                    <Mail className="w-6 h-6 text-accent mr-3" />
                                    {userContext.contactDetails.email}
                                </p>
                            </div>
                        )}
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.6 }}
                        className="bg-secondary p-8 rounded-lg shadow-lg"
                    >
                        <h3 className="font-heading text-3xl font-semibold mb-6 text-text">Send Us a Message</h3>
                        <form className="space-y-4">
                            <div>
                                <label htmlFor="name" className="sr-only">Name</label>
                                <input type="text" id="name" placeholder="Your Name"
                                    className="w-full p-3 rounded-md bg-background text-text border border-gray-700 focus:border-primary focus:ring-primary outline-none font-body" />
                            </div>
                            <div>
                                <label htmlFor="email" className="sr-only">Email</label>
                                <input type="email" id="email" placeholder="Your Email"
                                    className="w-full p-3 rounded-md bg-background text-text border border-gray-700 focus:border-primary focus:ring-primary outline-none font-body" />
                            </div>
                            <div>
                                <label htmlFor="message" className="sr-only">Message</label>
                                <textarea id="message" rows="5" placeholder="Your Message"
                                    className="w-full p-3 rounded-md bg-background text-text border border-gray-700 focus:border-primary focus:ring-primary outline-none font-body"></textarea>
                            </div>
                            <motion.button
                                type="submit"
                                className="w-full px-8 py-4 rounded-full font-body text-lg font-semibold"
                                style={{ backgroundColor: buttonBackground, color: buttonText }}
                                whileHover={{ scale: 1.02, boxShadow: `0 0 15px ${primary}` }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Send Message
                            </motion.button>
                        </form>
                    </motion.div>
                </div>
            </div>
        </section>
    );

    const Footer = () => {
        const footerClasses = "py-12 md:py-16 bg-secondary text-text";
        const columnClasses = "space-y-4";

        return (
            <footer data-section="footer" className={footerClasses}>
                <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    <div className={columnClasses}>
                        {renderLogo()}
                        <p className="font-body text-sm text-gray-400 mt-4">
                            {businessName} is dedicated to capturing life's most precious moments with artistry and precision.
                        </p>
                        <div className="flex space-x-4 mt-4">
                            <a href="#" aria-label="Facebook" className="text-gray-400 hover:text-primary transition-colors"><Facebook size={20} /></a>
                            <a href="#" aria-label="Instagram" className="text-gray-400 hover:text-primary transition-colors"><Instagram size={20} /></a>
                            <a href="#" aria-label="Twitter" className="text-gray-400 hover:text-primary transition-colors"><Twitter size={20} /></a>
                            <a href="#" aria-label="LinkedIn" className="text-gray-400 hover:text-primary transition-colors"><Linkedin size={20} /></a>
                        </div>
                    </div>

                    <div className={columnClasses}>
                        <h3 className="font-heading text-xl font-semibold text-text">Quick Links</h3>
                        <ul className="font-body space-y-2">
                            {navLinks.map(link => (
                                <li key={link.name}>
                                    <a href={link.href} className="text-gray-400 hover:text-primary transition-colors">
                                        {link.name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {userContext.contactDetails && (
                        <div className={columnClasses}>
                            <h3 className="font-heading text-xl font-semibold text-text">Contact Us</h3>
                            <p className="font-body text-gray-400 flex items-center">
                                <MapPin className="w-5 h-5 text-accent mr-2" /> {userContext.contactDetails.address}
                            </p>
                            <p className="font-body text-gray-400 flex items-center">
                                <Phone className="w-5 h-5 text-accent mr-2" /> {userContext.contactDetails.phone}
                            </p>
                            <p className="font-body text-gray-400 flex items-center">
                                <Mail className="w-5 h-5 text-accent mr-2" /> {userContext.contactDetails.email}
                            </p>
                        </div>
                    )}

                    {userContext.openingHours && userContext.openingHours.length > 0 && (
                        <div className={columnClasses}>
                            <h3 className="font-heading text-xl font-semibold text-text">Opening Hours</h3>
                            <ul className="font-body space-y-2 text-gray-400">
                                {userContext.openingHours.map((item, index) => (
                                    <li key={index} className="flex justify-between">
                                        <span>{item.day}:</span>
                                        <span>{item.hours}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                <div className="border-t border-gray-700 mt-12 pt-8 text-center">
                    <p className="font-body text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
                    </p>
                </div>
            </footer>
        );
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: background, color: text }}>
            <style>
                {`
                :root {
                    --color-primary: ${primary};
                    --color-secondary: ${secondary};
                    --color-accent: ${accent};
                    --color-background: ${background};
                    --color-text: ${text};
                    --color-buttonBackground: ${buttonBackground};
                    --color-buttonText: ${buttonText};
                    --font-heading: "${googleFonts.heading}", sans-serif;
                    --font-body: "${googleFonts.body}", sans-serif;
                }
                body {
                    font-family: var(--font-body);
                    color: var(--color-text);
                    background-color: var(--color-background);
                }
                h1, h2, h3, h4, h5, h6 {
                    font-family: var(--font-heading);
                    color: var(--color-text); /* Headings should also use text color */
                }
                .font-heading { font-family: var(--font-heading); }
                .font-body { font-family: var(--font-body); }
                .bg-primary { background-color: var(--color-primary); }
                .text-primary { color: var(--color-primary); }
                .bg-secondary { background-color: var(--color-secondary); }
                .text-secondary { color: var(--color-secondary); }
                .bg-accent { background-color: var(--color-accent); }
                .text-accent { color: var(--color-accent); }
                .bg-background { background-color: var(--color-background); }
                .text-text { color: var(--color-text); }
                .bg-buttonBackground { background-color: var(--color-buttonBackground); }
                .text-buttonText { color: var(--color-buttonText); }
                `}
            </style>
            <Header />
            <main className="flex-grow">
                <Hero />
                <About />
                <Services />
                <Portfolio />
                {userContext.reviews && userContext.reviews.length > 0 && <Testimonials />}
                {userContext.contactDetails && <Contact />}
            </main>
            <Footer />
        </div>
    );
}

export default App;