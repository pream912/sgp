import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, Dental, Heart, Calendar, MessageSquare, Star, Smile, Quote } from 'lucide-react';

// --- Design System and User Context Data ---
const designSystem = {
  "businessName": "Surya Dental Care",
  "colorPalette": {
    "primary": "#00A3B0",
    "secondary": "#DEEBEF",
    "accent": "#6DCFF6",
    "background": "#F5F8F9",
    "text": "#2A3D45",
    "buttonBackground": "#00A3B0",
    "buttonText": "#FFFFFF"
  },
  "typography": {
    "fontFamily": "Montserrat, Open Sans",
    "scale": "1.25"
  },
  "googleFonts": {
    "heading": "Montserrat",
    "body": "Open Sans"
  },
  "vibe": "Clean, Modern, Calm, Trustworthy, Approachable",
  "layoutStructure": "Clean, intuitive, and patient-focused layout with clear navigation and prominent service information.",
  "heroStyle": "Split Screen (Text Left/Image Right)",
  "headerStyle": "Simple Logo Left, Links Right",
  "footerStyle": "Standard Footer with Links and Socials", // Completed this line
  "imageUrls": [
    "https://images.unsplash.com/photo-1563227812-083f8ff5567a?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1588776814528-9de18561689d?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1559839734-2b71fa68ef96?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1585233299298-ba9012674e22?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
  ],
  "logoUrl": null
};

const userContext = {
  "businessName": "Surya Dental Care",
  "tagline": "Your Smile, Our Priority – Compassionate Dental Care for All Ages.",
  "description": "Surya Dental Care is dedicated to providing high-quality, comprehensive dental services in a comfortable and friendly environment. Our experienced team uses the latest technology to ensure optimal oral health and beautiful smiles for our patients.",
  "contactDetails": {
    "address": "123 Dental Avenue, Smile City, SC 12345",
    "phone": "+1 (555) 123-4567",
    "email": "info@suryadental.com"
  },
  "openingHours": [
    { "day": "Monday - Friday", "hours": "9:00 AM - 6:00 PM" },
    { "day": "Saturday", "hours": "10:00 AM - 2:00 PM" },
    { "day": "Sunday", "hours": "Closed" }
  ],
  "keyServices": [
    {
      "name": "General Dentistry",
      "description": "Routine check-ups, cleanings, fillings, and preventive care to maintain your oral health.",
      "icon": "Dental"
    },
    {
      "name": "Cosmetic Dentistry",
      "description": "Teeth whitening, veneers, and bonding to enhance the aesthetics of your smile.",
      "icon": "Smile"
    },
    {
      "name": "Orthodontics",
      "description": "Braces and clear aligners to correct misaligned teeth and bites.",
      "icon": "Heart"
    },
    {
      "name": "Emergency Dental Care",
      "description": "Prompt treatment for dental emergencies like toothaches, broken teeth, and injuries.",
      "icon": "Calendar"
    }
  ],
  "reviews": [
    {
      "author": "Priya Sharma",
      "rating": 5,
      "quote": "Surya Dental Care provides exceptional service! The staff is friendly, and Dr. Surya is very gentle and thorough. My family and I always feel comfortable here."
    },
    {
      "author": "Rahul Singh",
      "rating": 5,
      "quote": "Highly recommend Surya Dental Care. They handled my emergency with such professionalism and care. Best dental experience I've had in years!"
    },
    {
      "author": "Anjali Mehta",
      "rating": 4,
      "quote": "A very clean and modern clinic. The team is knowledgeable and always takes the time to explain procedures. Great experience overall."
    }
  ],
  "socialMedia": {
    "facebook": "https://facebook.com/suryadental",
    "instagram": "https://instagram.com/suryadental",
    "twitter": "https://twitter.com/suryadental"
  }
};

const {
  businessName, tagline, description, contactDetails, openingHours, keyServices, reviews, socialMedia
} = userContext;

const {
  colorPalette, typography, googleFonts, heroStyle, headerStyle, footerStyle, imageUrls, logoUrl
} = designSystem;

// Tailwind config for custom fonts (assuming it's set up in tailwind.config.js)
// extend: { fontFamily: { heading: ['Montserrat', 'sans-serif'], body: ['Open Sans', 'sans-serif'] } }

const getIconComponent = (iconName) => {
  const icons = { Dental, Heart, Calendar, Smile, Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, MessageSquare, Star, Quote };
  return icons[iconName] || MessageSquare; // Default icon
};

const App = () => {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setImageIndex((prevIndex) => (prevIndex + 1) % imageUrls.length);
    }, 5000); // Change image every 5 seconds
    return () => clearInterval(interval);
  }, [imageUrls.length]);

  const headerVariants = {
    hidden: { y: -100, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 20 } }
  };

  const heroTextVariants = {
    hidden: { x: -100, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { delay: 0.3, duration: 0.8, ease: "easeOut" } }
  };

  const heroImageVariants = {
    hidden: { x: 100, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { delay: 0.5, duration: 0.8, ease: "easeOut" } }
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } }
  };


  return (
    <div className="min-h-screen bg-background text-text font-body">
      {/* Header */}
      <motion.header
        data-section="header"
        className={`w-full z-50 py-4 px-8 flex justify-between items-center bg-primary text-buttonText shadow-md`}
        variants={headerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Company Logo" className="h-10 w-auto mr-3" />
          ) : (
            <h1 className="text-2xl font-heading font-bold text-buttonText">{businessName}</h1>
          )}
        </div>
        <nav>
          <ul className="flex space-x-6">
            <li><a href="#hero" className="hover:text-accent transition-colors duration-200">Home</a></li>
            <li><a href="#about" className="hover:text-accent transition-colors duration-200">About</a></li>
            <li><a href="#services" className="hover:text-accent transition-colors duration-200">Services</a></li>
            <li><a href="#testimonials" className="hover:text-accent transition-colors duration-200">Testimonials</a></li>
            <li><a href="#contact" className="hover:text-accent transition-colors duration-200">Contact</a></li>
          </ul>
        </nav>
      </motion.header>

      {/* Hero Section */}
      <section data-section="hero" id="hero" className="relative h-[calc(100vh-80px)] flex items-center justify-center overflow-hidden">
        <motion.div
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrls[imageIndex]})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          key={imageIndex}
        />
        <div className="absolute inset-0 bg-black/50" /> {/* Dark overlay */}

        <div className="relative z-10 container mx-auto px-8 py-16 flex flex-col md:flex-row items-center justify-between text-buttonText gap-8">
          <motion.div className="md:w-1/2 text-center md:text-left" variants={heroTextVariants} initial="hidden" animate="visible">
            <h2 className="text-5xl font-heading font-extrabold leading-tight mb-4">{businessName}</h2>
            <p className="text-xl font-body mb-6">{tagline}</p>
            <motion.button
              className="px-8 py-3 rounded-full bg-buttonBackground text-buttonText font-bold text-lg hover:opacity-90 transition-opacity duration-300 shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Book an Appointment
            </motion.button>
          </motion.div>
          <motion.div className="md:w-1/2 flex justify-center md:justify-end" variants={heroImageVariants} initial="hidden" animate="visible">
            {/* Image is already background, so this space can be for a subtle graphic or just empty for balance */}
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <motion.section
        data-section="about"
        id="about"
        className="py-20 px-8 bg-secondary text-text"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-heading font-bold mb-6 text-primary">About {businessName}</h2>
          <p className="text-lg font-body leading-relaxed">{description}</p>
        </div>
      </motion.section>

      {/* Services Section */}
      {keyServices && keyServices.length > 0 && (
        <motion.section
          data-section="services"
          id="services"
          className="py-20 px-8 bg-background text-text"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="container mx-auto">
            <h2 className="text-4xl font-heading font-bold text-center mb-12 text-primary">Our Key Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {keyServices.map((service, index) => {
                const IconComponent = getIconComponent(service.icon);
                return (
                  <motion.div
                    key={index}
                    className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center text-center border-b-4 border-primary hover:border-accent transition-all duration-300"
                    variants={cardVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ translateY: -5 }}
                  >
                    <IconComponent className="h-16 w-16 text-primary mb-4" />
                    <h3 className="text-2xl font-heading font-semibold mb-3 text-text">{service.name}</h3>
                    <p className="text-md font-body text-gray-600">{service.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>
      )}

      {/* Testimonials Section */}
      {reviews && reviews.length > 0 && (
        <motion.section
          data-section="testimonials"
          id="testimonials"
          className="py-20 px-8 bg-secondary text-text"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="container mx-auto">
            <h2 className="text-4xl font-heading font-bold text-center mb-12 text-primary">What Our Patients Say</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {reviews.map((review, index) => (
                <motion.div
                  key={index}
                  className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center text-center relative border-t-4 border-accent"
                  variants={cardVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ translateY: -5 }}
                >
                  <Quote className="absolute top-4 left-4 h-8 w-8 text-primary opacity-20" />
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-5 w-5 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <p className="text-lg italic font-body mb-4 text-text leading-relaxed">"{review.quote}"</p>
                  <p className="font-heading font-semibold text-primary">- {review.author}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* Contact Section */}
      {contactDetails && (
        <motion.section
          data-section="contact"
          id="contact"
          className="py-20 px-8 bg-background text-text"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="container mx-auto flex flex-col md:flex-row gap-12 items-center justify-between">
            <div className="md:w-1/2 text-center md:text-left">
              <h2 className="text-4xl font-heading font-bold mb-6 text-primary">Get in Touch</h2>
              <p className="text-lg font-body mb-8 leading-relaxed">
                We'd love to hear from you! Contact us today to schedule an appointment or to learn more about our services.
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-center md:justify-start text-lg">
                  <MapPin className="h-6 w-6 text-accent mr-3 flex-shrink-0" />
                  <span className="font-body">{contactDetails.address}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start text-lg">
                  <Phone className="h-6 w-6 text-accent mr-3 flex-shrink-0" />
                  <a href={`tel:${contactDetails.phone}`} className="hover:underline font-body">{contactDetails.phone}</a>
                </div>
                <div className="flex items-center justify-center md:justify-start text-lg">
                  <Mail className="h-6 w-6 text-accent mr-3 flex-shrink-0" />
                  <a href={`mailto:${contactDetails.email}`} className="hover:underline font-body">{contactDetails.email}</a>
                </div>
              </div>
            </div>
            <motion.div
              className="md:w-1/2 w-full h-80 bg-gray-200 rounded-lg shadow-lg overflow-hidden"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6 }}
            >
              {/* Placeholder for a map or contact form */}
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.250567756187!2d-122.41941568468133!3d37.77492947975929!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8085808f9f9b5a0f%3A0x4a501367f076ad8!2sSan%20Francisco%2C%20CA!5e0!3m2!1sen!2sus!4v1647890000000!5m2!1sen!2sus"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                title="Google Map Location"
              ></iframe>
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* Footer */}
      <motion.footer
        data-section="footer"
        className="bg-primary text-buttonText py-12 px-8 font-body"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          {/* Business Info */}
          <div>
            {logoUrl ? (
              <img src={logoUrl} alt="Company Logo" className="h-10 w-auto mx-auto md:mx-0 mb-4" />
            ) : (
              <h3 className="text-2xl font-heading font-bold mb-4">{businessName}</h3>
            )}
            <p className="text-sm mb-4">{tagline}</p>
            <div className="flex justify-center md:justify-start space-x-4">
              {socialMedia.facebook && <a href={socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors"><Facebook className="h-6 w-6" /></a>}
              {socialMedia.instagram && <a href={socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors"><Instagram className="h-6 w-6" /></a>}
              {socialMedia.twitter && <a href={socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors"><Twitter className="h-6 w-6" /></a>}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-heading font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="#about" className="hover:text-accent transition-colors">About Us</a></li>
              <li><a href="#services" className="hover:text-accent transition-colors">Services</a></li>
              <li><a href="#testimonials" className="hover:text-accent transition-colors">Testimonials</a></li>
              <li><a href="#contact" className="hover:text-accent transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Contact & Hours */}
          <div>
            <h3 className="text-xl font-heading font-semibold mb-4">Contact & Hours</h3>
            {contactDetails && (
              <div className="space-y-2 mb-4">
                <p className="flex items-center justify-center md:justify-start"><MapPin className="h-5 w-5 mr-2" /> {contactDetails.address}</p>
                <p className="flex items-center justify-center md:justify-start"><Phone className="h-5 w-5 mr-2" /> {contactDetails.phone}</p>
                <p className="flex items-center justify-center md:justify-start"><Mail className="h-5 w-5 mr-2" /> {contactDetails.email}</p>
              </div>
            )}
            {openingHours && openingHours.length > 0 && (
              <div className="space-y-1">
                {openingHours.map((item, index) => (
                  <p key={index} className="flex items-center justify-center md:justify-start text-sm">
                    {index === 0 && <Clock className="h-5 w-5 mr-2" />}
                    {index !== 0 && <span className="w-7"></span>} {/* Spacer for alignment */}
                    <span>{item.day}: {item.hours}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-primary/50 pt-8 mt-8 text-center text-sm">
          &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
        </div>
      </motion.footer>
    </div>
  );
};

export default App;