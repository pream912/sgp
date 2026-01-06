import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, X, Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, Star, CheckCircle } from 'lucide-react';

// Design System and User Context Data
const designSystem = {
  "businessName": "JPR STUDIO",
  "colorPalette": {
    "primary": "#A52A2A",
    "secondary": "#1A1A70",
    "accent": "#B8860B",
    "background": "#1A1A1A",
    "text": "#F0F0F0",
    "buttonBackground": "#A52A2A",
    "buttonText": "#FFFFFF"
  },
  "typography": {
    "fontFamily": "Montserrat, sans-serif; Open Sans, sans-serif",
    "scale": "modular"
  },
  "googleFonts": {
    "heading": "Montserrat",
    "body": "Open Sans"
  },
  "vibe": "Professional, High-Quality, Customer-Focused, Energetic, Trustworthy",
  "layoutStructure": "A clean, modern layout with a focus on visual content. Sections are clearly defined, providing a professional and easy-to-navigate user experience.",
  "heroStyle": "Split Screen (Text Left/Image Right)",
  "headerStyle": "Simple Logo Left, Links Right",
  "footerStyle": "Standard Centered with Social Media",
  "logoUrl": "./logo.png", // CRITICAL: This is present, so use it.
  "imageUrls": [
    "https://images.unsplash.com/photo-1517032200726-076748645255?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1520004434532-668560504d65?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2942&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
  ]
};

const userContext = {
  "aboutUs": "JPR Studio is a leading creative agency dedicated to transforming ideas into compelling visual stories. With a passion for innovation and an eye for detail, we specialize in delivering high-quality design, branding, and multimedia solutions that resonate with your audience. Our team of experienced professionals is committed to bringing your vision to life, ensuring every project reflects excellence and achieves measurable results. We believe in building strong partnerships and providing personalized service to help our clients succeed in a dynamic marketplace.",
  "callToAction": "Ready to elevate your brand? Contact us today for a consultation!",
  "reviews": [
    {
      "id": 1,
      "author": "Alice Johnson",
      "quote": "JPR Studio transformed our brand identity. Their creativity and professionalism exceeded our expectations!",
      "rating": 5
    },
    {
      "id": 2,
      "author": "Bob Williams",
      "quote": "Outstanding service and incredible results. Our new website is exactly what we envisioned, thanks to JPR Studio.",
      "rating": 5
    },
    {
      "id": 3,
      "author": "Carol Davis",
      "quote": "The team at JPR Studio is truly talented. They captured our vision perfectly and delivered on time and within budget.",
      "rating": 4
    }
  ],
  "contactDetails": {
    "address": "123 Creative Lane, Suite 400, Design City, DC 12345",
    "phone": "+1 (555) 123-4567",
    "email": "info@jprstudio.com"
  },
  "openingHours": [
    "Monday - Friday: 9:00 AM - 6:00 PM",
    "Saturday: 10:00 AM - 2:00 PM",
    "Sunday: Closed"
  ],
  "keyServices": [
    "Brand Strategy & Development",
    "Web Design & Development",
    "Graphic Design & Print",
    "Digital Marketing & SEO",
    "Video Production & Editing",
    "UI/UX Design"
  ]
};

// Helper to get image URL safely
let imageIndex = 0;
const getImageUrl = () => {
  const url = designSystem.imageUrls[imageIndex % designSystem.imageUrls.length];
  imageIndex++;
  return url;
};

// Tailwind CSS configuration (conceptual, applied via classes)
// This would typically be in tailwind.config.js
// extend: {
//   colors: {
//     primary: designSystem.colorPalette.primary,
//     secondary: designSystem.colorPalette.secondary,
//     accent: designSystem.colorPalette.accent,
//     background: designSystem.colorPalette.background,
//     text: designSystem.colorPalette.text,
//     buttonBackground: designSystem.colorPalette.buttonBackground,
//     buttonText: designSystem.colorPalette.buttonText,
//   },
//   fontFamily: {
//     heading: [designSystem.googleFonts.heading, 'sans-serif'],
//     body: [designSystem.googleFonts.body, 'sans-serif'],
//   },
// },

const App = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Home', href: '#hero' },
    { name: 'About', href: '#about' },
    { name: 'Services', href: '#services' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'Contact', href: '#contact' },
  ];

  const headerVariants = {
    hidden: { y: -100, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 20 } },
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const buttonVariants = {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  };

  const renderLogo = () => {
    if (designSystem.logoUrl) {
      return <img src={designSystem.logoUrl} alt={`${designSystem.businessName} Logo`} className="h-10 w-auto" />;
    }
    return <span className="text-2xl font-heading font-bold text-text">{designSystem.businessName}</span>;
  };

  return (
    <div className="min-h-screen bg-background text-text font-body">
      {/* Header */}
      <motion.header
        data-section="header"
        initial="hidden"
        animate="visible"
        variants={headerVariants}
        className={`fixed top-0 w-full z-50 py-4 px-6 md:px-12 flex justify-between items-center bg-background shadow-lg`}
      >
        <div className="flex items-center">
          <a href="#hero" className="flex items-center">
            {renderLogo()}
          </a>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-text hover:text-accent font-heading transition-colors duration-300"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-text focus:outline-none">
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed inset-0 bg-background z-40 flex flex-col items-center justify-center space-y-8 md:hidden"
          >
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-6 right-6 text-text focus:outline-none"
            >
              <X size={32} />
            </button>
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-text text-3xl font-heading hover:text-accent transition-colors duration-300"
              >
                {link.name}
              </a>
            ))}
          </motion.div>
        )}
      </motion.header>

      <main>
        {/* Hero Section - Split Screen (Text Left/Image Right) */}
        <section data-section="hero" id="hero" className="relative h-screen flex flex-col md:flex-row items-center justify-center pt-16 md:pt-0">
          <div className="absolute inset-0 bg-background z-0"></div> {/* Background for the whole section */}
          <div className="relative z-10 w-full md:w-1/2 h-full flex flex-col justify-center items-center p-8 md:p-16 text-center md:text-left">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-5xl md:text-6xl font-heading font-extrabold text-primary mb-4 leading-tight"
            >
              {designSystem.businessName}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-lg md:text-xl font-body text-text mb-8 max-w-lg"
            >
              {userContext.aboutUs.split('. ')[0]}. {userContext.aboutUs.split('. ')[1]}.
            </motion.p>
            <motion.a
              href="#contact"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="px-8 py-3 bg-buttonBackground text-buttonText font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Get Started
            </motion.a>
          </div>
          <div className="relative z-10 w-full md:w-1/2 h-1/2 md:h-full overflow-hidden">
            <motion.img
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              src={getImageUrl()}
              alt="Hero Background"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/30"></div> {/* Light overlay for image */}
          </div>
        </section>

        {/* About Us Section */}
        <motion.section
          data-section="about"
          id="about"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="py-16 px-6 md:px-12 bg-secondary text-text"
        >
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <motion.img
                src={getImageUrl()}
                alt="About Us"
                className="rounded-lg shadow-xl w-full h-auto object-cover"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              />
            </div>
            <div className="md:w-1/2 text-center md:text-left">
              <h2 className="text-4xl font-heading font-bold text-accent mb-6">About Our Studio</h2>
              <p className="text-lg font-body leading-relaxed mb-8">
                {userContext.aboutUs}
              </p>
              <motion.a
                href="#services"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                className="px-8 py-3 bg-buttonBackground text-buttonText font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Our Services
              </motion.a>
            </div>
          </div>
        </motion.section>

        {/* Key Services Section */}
        <motion.section
          data-section="services"
          id="services"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="py-16 px-6 md:px-12 bg-background text-text"
        >
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-4xl font-heading font-bold text-primary mb-12">Our Key Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {userContext.keyServices.map((service, index) => (
                <motion.div
                  key={index}
                  className="bg-secondary p-8 rounded-lg shadow-lg flex flex-col items-center text-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <CheckCircle size={48} className="text-accent mb-4" />
                  <h3 className="text-2xl font-heading font-semibold text-text mb-3">{service}</h3>
                  <p className="text-md font-body text-gray-300">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Testimonials Section */}
        <motion.section
          data-section="testimonials"
          id="testimonials"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="py-16 px-6 md:px-12 bg-primary text-buttonText"
        >
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-4xl font-heading font-bold text-buttonText mb-12">What Our Clients Say</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {userContext.reviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  className="bg-secondary p-8 rounded-lg shadow-lg flex flex-col items-center text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                >
                  <div className="flex mb-4">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} size={24} className="text-accent" fill="currentColor" />
                    ))}
                    {[...Array(5 - review.rating)].map((_, i) => (
                      <Star key={i + review.rating} size={24} className="text-accent" />
                    ))}
                  </div>
                  <p className="text-lg font-body italic mb-4">"{review.quote}"</p>
                  <p className="text-md font-heading font-semibold text-accent">- {review.author}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Call to Action */}
        <motion.section
          data-section="cta"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="py-20 px-6 md:px-12 bg-background text-text text-center"
        >
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-heading font-bold text-primary mb-6">{userContext.callToAction}</h2>
            <p className="text-xl font-body mb-10 max-w-2xl mx-auto">
              Let's discuss how we can bring your vision to life with our expert design and development services.
            </p>
            <motion.a
              href="#contact"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className="px-10 py-4 bg-buttonBackground text-buttonText font-heading font-semibold text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Contact Us Now
            </motion.a>
          </div>
        </motion.section>

        {/* Contact Section */}
        <motion.section
          data-section="contact"
          id="contact"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="py-16 px-6 md:px-12 bg-secondary text-text"
        >
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-4xl font-heading font-bold text-accent mb-12">Get In Touch</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Contact Form */}
              <motion.div
                className="bg-background p-8 rounded-lg shadow-lg text-left"
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7 }}
              >
                <h3 className="text-3xl font-heading font-semibold text-primary mb-6">Send Us a Message</h3>
                <form className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-text text-lg font-body mb-2">Name</label>
                    <input type="text" id="name" className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-text focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Your Name" />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-text text-lg font-body mb-2">Email</label>
                    <input type="email" id="email" className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-text focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Your Email" />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-text text-lg font-body mb-2">Message</label>
                    <textarea id="message" rows="5" className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-text focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Your Message"></textarea>
                  </div>
                  <motion.button
                    type="submit"
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    className="w-full px-8 py-3 bg-buttonBackground text-buttonText font-heading font-semibold rounded-md shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Send Message
                  </motion.button>
                </form>
              </motion.div>

              {/* Contact Info */}
              <motion.div
                className="bg-background p-8 rounded-lg shadow-lg text-left"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7 }}
              >
                <h3 className="text-3xl font-heading font-semibold text-primary mb-6">Our Details</h3>
                <div className="space-y-6">
                  <div className="flex items-start">
                    <MapPin size={24} className="text-accent mr-4 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-heading font-semibold text-text">Address:</p>
                      <p className="text-md font-body text-gray-300">{userContext.contactDetails.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Phone size={24} className="text-accent mr-4" />
                    <div>
                      <p className="text-lg font-heading font-semibold text-text">Phone:</p>
                      <p className="text-md font-body text-gray-300">{userContext.contactDetails.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Mail size={24} className="text-accent mr-4" />
                    <div>
                      <p className="text-lg font-heading font-semibold text-text">Email:</p>
                      <p className="text-md font-body text-gray-300">{userContext.contactDetails.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Clock size={24} className="text-accent mr-4 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-heading font-semibold text-text">Opening Hours:</p>
                      <ul className="text-md font-body text-gray-300 list-none p-0">
                        {userContext.openingHours.map((hour, index) => (
                          <li key={index}>{hour}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <motion.footer
        data-section="footer"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="bg-background text-text py-12 px-6 md:px-12 text-center"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center justify-center mb-8">
            <a href="#hero" className="mb-4">
              {renderLogo()}
            </a>
            <p className="text-lg font-body mb-4">&copy; {new Date().getFullYear()} {designSystem.businessName}. All rights reserved.</p>
            <div className="flex space-x-6">
              <a href="#" className="text-text hover:text-accent transition-colors duration-300">
                <Facebook size={24} />
              </a>
              <a href="#" className="text-text hover:text-accent transition-colors duration-300">
                <Instagram size={24} />
              </a>
              <a href="#" className="text-text hover:text-accent transition-colors duration-300">
                <Twitter size={24} />
              </a>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default App;