import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, Menu, X, ChevronRight, Star } from 'lucide-react';

// Design System and User Context
const designSystem = {
  businessName: "Smile Dental Care",
  colorPalette: {
    primary: "#003366",
    secondary: "#66BB6A",
    accent: "#D46A6A",
    background: "#F8F8F8",
    text: "#1A1A1A",
    buttonBackground: "#003366",
    buttonText: "#FFFFFF"
  },
  typography: {
    fontFamily: "Montserrat, Roboto, sans-serif",
    scale: "modular"
  },
  googleFonts: {
    heading: "Montserrat",
    body: "Roboto"
  },
  vibe: "Friendly, Patient-Centric, Advanced, Reassuring, Clean, Professional",
  layoutStructure: "Clean, organized content sections with clear calls to action, emphasizing patient comfort and advanced technology.",
  heroStyle: "Split Screen (Text Left/Image Right)",
  headerStyle: "Double Navbar (Top Info Bar + Main Nav)",
  footerStyle: "Interactive Map & Contact Footer",
  imageKeywords: ["dental clinic interior", "dentist patient examination", "happy patient smile", "modern dental equipment", "dental team consultation", "bright dental reception"],
  imageUrls: [
    "https://images.unsplash.com/photo-1563236780-e9a26ef7970f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1585489725530-b3040375a02e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1585489725530-b3040375a02e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1585489725530-b3040375a02e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1585489725530-b3040375a02e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1585489725530-b3040375a02e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
  ],
  logoUrl: null
};

const userContext = {
  businessName: "Smile Dental Care",
  tagline: "Your Brightest Smile Starts Here",
  aboutUs: "At Smile Dental Care, we are dedicated to providing the highest quality dental care in a comfortable and friendly environment. Our team of experienced professionals uses the latest technology to ensure you receive the best possible treatment, from routine check-ups to advanced cosmetic procedures. We believe in patient education and personalized care, helping you achieve and maintain optimal oral health for a lifetime.",
  callToAction: "Schedule Your Appointment Today!",
  keyServices: [
    { name: "General Dentistry", description: "Routine check-ups, cleanings, fillings, and preventive care." },
    { name: "Cosmetic Dentistry", description: "Teeth whitening, veneers, bonding, and smile makeovers." },
    { name: "Orthodontics", description: "Braces and Invisalign for all ages." },
    { name: "Oral Surgery", description: "Extractions, wisdom teeth removal, and dental implants." },
    { name: "Emergency Dental Care", description: "Prompt treatment for dental emergencies." }
  ],
  reviews: [
    { author: "Sarah L.", quote: "The best dental experience I've ever had! The staff is incredibly kind and professional, and the clinic is so modern and clean. Highly recommend Smile Dental Care!", rating: 5 },
    { author: "Mark P.", quote: "I used to dread going to the dentist, but Smile Dental Care changed that. They made me feel so comfortable and explained everything clearly. My teeth feel amazing!", rating: 5 },
    { author: "Jessica R.", quote: "Excellent service from start to finish. Dr. Smith is fantastic, and the entire team goes above and beyond. My new go-to for dental care.", rating: 4 },
    { author: "David K.", quote: "Very impressed with the technology and the thoroughness of the examination. They truly care about their patients' oral health.", rating: 5 }
  ],
  contactDetails: {
    address: "123 Dental Avenue, Suite 100, Smileville, CA 90210",
    phone: "(123) 456-7890",
    email: "info@smiledentalcare.com"
  },
  openingHours: [
    { day: "Monday", hours: "9:00 AM - 5:00 PM" },
    { day: "Tuesday", hours: "9:00 AM - 5:00 PM" },
    { day: "Wednesday", hours: "9:00 AM - 5:00 PM" },
    { day: "Thursday", hours: "9:00 AM - 7:00 PM" },
    { day: "Friday", hours: "9:00 AM - 3:00 PM" },
    { day: "Saturday", hours: "Closed" },
    { day: "Sunday", hours: "Closed" }
  ],
  socialMedia: {
    facebook: "https://facebook.com/smiledentalcare",
    instagram: "https://instagram.com/smiledentalcare",
    twitter: "https://twitter.com/smiledentalcare"
  }
};

// Helper to get image URL
let imageIndex = 0;
const getImageUrl = () => {
  if (imageIndex >= designSystem.imageUrls.length) {
    imageIndex = 0; // Cycle back to the beginning
  }
  return designSystem.imageUrls[imageIndex++];
};

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderLogo = () => {
    if (designSystem.logoUrl) {
      return <img src={designSystem.logoUrl} alt={`${designSystem.businessName} Logo`} className="h-10 w-auto" />;
    }
    return <span className="font-heading text-2xl font-bold text-primary">{designSystem.businessName}</span>;
  };

  const navLinks = [
    { name: "Home", href: "#hero" },
    { name: "About Us", href: "#about" },
    { name: "Services", href: "#services" },
    { name: "Testimonials", href: "#testimonials" },
    { name: "Contact", href: "#contact" },
  ];

  const Header = () => {
    if (designSystem.headerStyle === "Double Navbar (Top Info Bar + Main Nav)") {
      return (
        <header className="fixed w-full z-50 shadow-md">
          {/* Top Info Bar */}
          <div className="bg-primary text-buttonText py-2 text-sm font-body">
            <div className="container mx-auto flex justify-between items-center px-4 md:px-8">
              <div className="flex items-center space-x-4">
                <a href={`tel:${userContext.contactDetails.phone}`} className="flex items-center hover:text-secondary transition-colors">
                  <Phone size={16} className="mr-1" />
                  <span>{userContext.contactDetails.phone}</span>
                </a>
                <a href={`mailto:${userContext.contactDetails.email}`} className="flex items-center hover:text-secondary transition-colors">
                  <Mail size={16} className="mr-1" />
                  <span>{userContext.contactDetails.email}</span>
                </a>
              </div>
              <div className="hidden md:flex items-center space-x-3">
                {userContext.socialMedia.facebook && <a href={userContext.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors"><Facebook size={18} /></a>}
                {userContext.socialMedia.instagram && <a href={userContext.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors"><Instagram size={18} /></a>}
                {userContext.socialMedia.twitter && <a href={userContext.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors"><Twitter size={18} /></a>}
              </div>
            </div>
          </div>

          {/* Main Navigation */}
          <nav className="bg-background py-4">
            <div className="container mx-auto flex justify-between items-center px-4 md:px-8">
              {renderLogo()}
              <div className="hidden md:flex space-x-8">
                {navLinks.map((link) => (
                  <a key={link.name} href={link.href} className="font-body text-text hover:text-primary transition-colors text-lg">
                    {link.name}
                  </a>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="hidden md:block px-6 py-2 rounded-full bg-buttonBackground text-buttonText font-body text-lg shadow-lg hover:shadow-xl transition-all"
              >
                {userContext.callToAction}
              </motion.button>
              <button
                className="md:hidden text-primary"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </nav>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="md:hidden bg-background absolute w-full shadow-lg pb-4"
              >
                <nav className="flex flex-col items-center space-y-4 pt-4">
                  {navLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      className="font-body text-text hover:text-primary transition-colors text-lg"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.name}
                    </a>
                  ))}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="mt-4 px-6 py-3 rounded-full bg-buttonBackground text-buttonText font-body text-lg shadow-lg hover:shadow-xl transition-all"
                  >
                    {userContext.callToAction}
                  </motion.button>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      );
    }
    // Default or other header styles can be added here
    return (
      <header className="fixed w-full z-50 bg-background shadow-md py-4">
        <div className="container mx-auto flex justify-between items-center px-4 md:px-8">
          {renderLogo()}
          <nav className="hidden md:flex space-x-8">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="font-body text-text hover:text-primary transition-colors text-lg">
                {link.name}
              </a>
            ))}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-2 rounded-full bg-buttonBackground text-buttonText font-body text-lg shadow-lg hover:shadow-xl transition-all"
            >
              {userContext.callToAction}
            </motion.button>
          </nav>
          <button
            className="md:hidden text-primary"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden bg-background absolute w-full shadow-lg pb-4"
            >
              <nav className="flex flex-col items-center space-y-4 pt-4">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="font-body text-text hover:text-primary transition-colors text-lg"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ))}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-4 px-6 py-3 rounded-full bg-buttonBackground text-buttonText font-body text-lg shadow-lg hover:shadow-xl transition-all"
                >
                  {userContext.callToAction}
                </motion.button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    );
  };

  const Hero = () => {
    if (designSystem.heroStyle === "Split Screen (Text Left/Image Right)") {
      return (
        <section data-section="hero" className="relative flex flex-col md:flex-row min-h-screen pt-24 md:pt-0 bg-background">
          <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center md:text-left max-w-lg"
            >
              <h1 className="font-heading text-5xl md:text-6xl font-extrabold text-primary leading-tight mb-4">
                {userContext.businessName}
              </h1>
              <p className="font-body text-xl md:text-2xl text-text mb-6">
                {userContext.tagline}
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-full bg-buttonBackground text-buttonText font-body text-xl shadow-lg hover:shadow-xl transition-all"
              >
                {userContext.callToAction}
              </motion.button>
            </motion.div>
          </div>
          <div className="w-full md:w-1/2 relative min-h-[300px] md:min-h-screen">
            <motion.img
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              src={getImageUrl()}
              alt="Dental Clinic Interior"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-primary/20"></div> {/* Subtle overlay */}
          </div>
        </section>
      );
    }
    // Default hero style
    return (
      <section
        data-section="hero"
        className="relative h-screen flex items-center justify-center text-center overflow-hidden pt-16"
      >
        <img
          src={getImageUrl()}
          alt="Hero Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl text-buttonText"
          >
            <h1 className="font-heading text-5xl md:text-7xl font-extrabold leading-tight mb-4">
              {userContext.businessName}
            </h1>
            <p className="font-body text-xl md:text-3xl mb-8">
              {userContext.tagline}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-full bg-buttonBackground text-buttonText font-body text-xl shadow-lg hover:shadow-xl transition-all"
            >
              {userContext.callToAction}
            </motion.button>
          </motion.div>
        </div>
      </section>
    );
  };

  const AboutUs = () => (
    <section data-section="about" className="bg-background py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center gap-12">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="md:w-1/2"
        >
          <img
            src={getImageUrl()}
            alt="About Us"
            className="rounded-lg shadow-xl w-full h-auto object-cover max-h-96"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="md:w-1/2 text-center md:text-left"
        >
          <h2 className="font-heading text-4xl font-bold text-primary mb-6">About {userContext.businessName}</h2>
          <p className="font-body text-lg text-text leading-relaxed">
            {userContext.aboutUs}
          </p>
        </motion.div>
      </div>
    </section>
  );

  const Services = () => (
    <section data-section="services" className="bg-primary text-buttonText py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="font-heading text-4xl font-bold mb-12"
        >
          Our Key Services
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {userContext.keyServices.map((service, index) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-buttonText text-text p-8 rounded-lg shadow-xl flex flex-col items-center text-center"
            >
              <ChevronRight size={48} className="text-secondary mb-4" />
              <h3 className="font-heading text-2xl font-semibold mb-4 text-primary">{service.name}</h3>
              <p className="font-body text-lg">{service.description}</p>
            </motion.div>
          ))}
        </div>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mt-12 px-8 py-4 rounded-full bg-secondary text-buttonText font-body text-xl shadow-lg hover:shadow-xl transition-all"
        >
          View All Services
        </motion.button>
      </div>
    </section>
  );

  const Testimonials = () => (
    <section data-section="testimonials" className="bg-background py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="font-heading text-4xl font-bold text-primary mb-12"
        >
          What Our Patients Say
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {userContext.reviews.map((review, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-buttonText p-8 rounded-lg shadow-xl flex flex-col items-center text-center"
            >
              <div className="flex mb-4">
                {[...Array(review.rating)].map((_, i) => (
                  <Star key={i} size={24} className="text-accent fill-accent" />
                ))}
                {[...Array(5 - review.rating)].map((_, i) => (
                  <Star key={i + review.rating} size={24} className="text-accent" />
                ))}
              </div>
              <p className="font-body text-lg text-text mb-4">
                "{review.quote}"
              </p>
              <p className="font-heading text-primary font-semibold">- {review.author}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );

  const Contact = () => (
    <section data-section="contact" className="bg-primary text-buttonText py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="font-heading text-4xl font-bold mb-12"
        >
          Contact Us
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-buttonText text-text p-8 rounded-lg shadow-xl flex flex-col items-center text-center"
          >
            <MapPin size={48} className="text-secondary mb-4" />
            <h3 className="font-heading text-2xl font-semibold mb-2 text-primary">Address</h3>
            <p className="font-body text-lg">{userContext.contactDetails.address}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-buttonText text-text p-8 rounded-lg shadow-xl flex flex-col items-center text-center"
          >
            <Phone size={48} className="text-secondary mb-4" />
            <h3 className="font-heading text-2xl font-semibold mb-2 text-primary">Phone</h3>
            <p className="font-body text-lg">{userContext.contactDetails.phone}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-buttonText text-text p-8 rounded-lg shadow-xl flex flex-col items-center text-center"
          >
            <Mail size={48} className="text-secondary mb-4" />
            <h3 className="font-heading text-2xl font-semibold mb-2 text-primary">Email</h3>
            <p className="font-body text-lg">{userContext.contactDetails.email}</p>
          </motion.div>
        </div>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mt-12 px-8 py-4 rounded-full bg-secondary text-buttonText font-body text-xl shadow-lg hover:shadow-xl transition-all"
        >
          {userContext.callToAction}
        </motion.button>
      </div>
    </section>
  );

  const Footer = () => {
    if (designSystem.footerStyle === "Interactive Map & Contact Footer") {
      return (
        <footer data-section="footer" className="bg-text text-buttonText pt-16">
          <div className="container mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-12">
            <div className="col-span-full lg:col-span-1 text-center md:text-left">
              {renderLogo()}
              <p className="font-body text-sm mt-4 leading-relaxed">
                {userContext.aboutUs.substring(0, 150)}...
              </p>
              <div className="flex justify-center md:justify-start space-x-4 mt-6">
                {userContext.socialMedia.facebook && <a href={userContext.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors"><Facebook size={24} /></a>}
                {userContext.socialMedia.instagram && <a href={userContext.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors"><Instagram size={24} /></a>}
                {userContext.socialMedia.twitter && <a href={userContext.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors"><Twitter size={24} /></a>}
              </div>
            </div>

            <div className="text-center md:text-left">
              <h3 className="font-heading text-xl font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 font-body">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <a href={link.href} className="hover:text-primary transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-center md:text-left">
              <h3 className="font-heading text-xl font-bold mb-4">Contact Info</h3>
              <ul className="space-y-2 font-body">
                <li className="flex items-center justify-center md:justify-start">
                  <MapPin size={18} className="mr-2 text-secondary" />
                  <span>{userContext.contactDetails.address}</span>
                </li>
                <li className="flex items-center justify-center md:justify-start">
                  <Phone size={18} className="mr-2 text-secondary" />
                  <a href={`tel:${userContext.contactDetails.phone}`} className="hover:text-primary transition-colors">{userContext.contactDetails.phone}</a>
                </li>
                <li className="flex items-center justify-center md:justify-start">
                  <Mail size={18} className="mr-2 text-secondary" />
                  <a href={`mailto:${userContext.contactDetails.email}`} className="hover:text-primary transition-colors">{userContext.contactDetails.email}</a>
                </li>
              </ul>
            </div>

            <div className="text-center md:text-left">
              <h3 className="font-heading text-xl font-bold mb-4">Opening Hours</h3>
              <ul className="space-y-2 font-body">
                {userContext.openingHours.map((item) => (
                  <li key={item.day} className="flex justify-between md:justify-start md:space-x-2">
                    <span className="font-semibold">{item.day}:</span>
                    <span>{item.hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Map Section */}
          <div className="w-full h-80 bg-gray-300 relative overflow-hidden">
            <iframe
              title="Google Map of Smile Dental Care"
              src={`https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(userContext.contactDetails.address)}&key=YOUR_GOOGLE_MAPS_API_KEY`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>

          <div className="bg-primary py-4 text-center text-sm font-body">
            <p>&copy; {new Date().getFullYear()} {userContext.businessName}. All rights reserved.</p>
          </div>
        </footer>
      );
    }
    // Default footer
    return (
      <footer data-section="footer" className="bg-text text-buttonText py-8">
        <div className="container mx-auto px-4 md:px-8 text-center">
          {renderLogo()}
          <p className="font-body text-sm mt-4">
            &copy; {new Date().getFullYear()} {userContext.businessName}. All rights reserved.
          </p>
          <div className="flex justify-center space-x