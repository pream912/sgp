import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, Stethoscope, Smile, Award, Lightbulb, HeartHandshake } from 'lucide-react';

// Design System
const designSystem = {
  "businessName": "Smile Dental Care",
  "colorPalette": {
    "primary": "#BD4F6C",
    "secondary": "#61B0B7",
    "accent": "#BEE9E8",
    "background": "#F8F8F8",
    "text": "#2C3E50",
    "buttonBackground": "#BD4F6C",
    "buttonText": "#F8F8F8"
  },
  "typography": {
    "fontFamily": "Montserrat, Open Sans, sans-serif",
    "scale": "modular scale"
  },
  "googleFonts": {
    "heading": "Montserrat",
    "body": "Open Sans"
  },
  "vibe": "Patient-Centric, Advanced, Reassuring, Friendly, Competent, Transparent",
  "layoutStructure": "Clean, modular layout with clear information hierarchy and soothing visuals, emphasizing patient comfort and professionalism.",
  "heroStyle": "Split Screen (Text Left/Image Right)",
  "headerStyle": "Simple Logo Left, Links Right",
  "footerStyle": "Multi-Column Links",
  "imageKeywords": ["dentist", "smile", "modern dental clinic", "patient comfort", "dental technology"],
  "imageUrls": ["https://images.unsplash.com/photo-1562330743-fbc6ef07ca78?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1639390159821-1cf308998c34?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1643660527064-8d43259f014a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1652549210729-68bbd206ae3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1660732205500-1b4ebaa4050b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1660737217660-30eda00a0f3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1663755489920-5e09f66d011a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1679741919483-acf704e00495?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1694345162188-2e5c06fe75e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1694359599925-b20e765c2422?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhYW5kb218fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1734518352234-a58257a579be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1734518352260-acb18b3f1e9c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTEyODB8MHwxfHJhbmRvbXx8fHx8fHx8fDE3Njc1NjgwMzN8&ixlib=rb-4.1.0&q=80&w=1080"],
  "logoUrl": "./logo.png"
};

// User Context
const userContext = {
  "businessSummary": "Smile Dental Care promises an exceptional and comfortable dental journey, leveraging advanced technology like low-level laser for smooth, painless procedures. Patients consistently praise their highly skilled and genuinely caring doctors for meticulous explanations, supported by a friendly team dedicated to a reassuring experience. They emphasize patient well-being with complimentary consultations, aiming to be your top choice for dental care.",
  "industry": "Dentistry",
  "vibe": "Patient-Centric, Advanced, Reassuring, Friendly, Competent, Transparent",
  "sellingPoints": [
    "Advanced low-level laser technology for comfortable and smooth procedures.",
    "Highly skilled and genuinely caring doctors who provide meticulous explanations.",
    "Friendly and supportive staff.",
    "Free consultations offered, reflecting a patient-first approach.",
    "Focus on creating a reassuring and peaceful dental experience.",
    "Specialization in effective treatments like Root Canal Therapy (RCT)."
  ],
  "contactDetails": {
    "address": "Basement, Joshi & Joshi Complex, 3rd St, opp. Kailash Nagar, opp. Zudio showroom, AVM Jyothi Nagar, Sakthi Nagar, Pappakurichi Kattur, Thanjavur, Tiruchirappalli, Tamil Nadu 620019, India",
    "phone": "097917 65077",
    "website": "http://www.smiledentalcaretrichy.com/"
  },
  "openingHours": {
    "Monday": "11:00 AM – 2:30 PM, 6:00 – 9:00 PM",
    "Tuesday": "11:00 AM – 2:30 PM, 6:00 – 9:00 PM",
    "Wednesday": "11:00 AM – 2:30 PM, 6:00 – 9:00 PM",
    "Thursday": "11:00 AM – 2:30 PM, 6:00 – 9:00 PM",
    "Friday": "11:00 AM – 2:30 PM, 6:00 – 9:00 PM",
    "Saturday": "11:00 AM – 2:30 PM, 6:00 – 9:00 PM",
    "Sunday": "6:00 – 8:30 PM"
  },
  "reviews": [
    { "author": "Umer sharief", "quote": "🤩 Exceptional Dental Care & Smooth Procedure! We had a truly excellent dental experience at this clinic recently for a cavity - low level laser. We were initially quite nervous, b..." },
    { "author": "Daya Anandhi Jayaraman", "quote": "The treatment was really good, and the doctor explained everything patiently Also staffs are so friendly" },
    { "author": "UNNATI KISHOR", "quote": "I chose this clinic after reading the reviews and because I was in a hurry, as my tooth was aching badly. I had considered going to Apollo, but since it was too far, I decided to c..." }
  ]
};

// Helper to cycle through images
let currentImageIndex = 0;
const getNextImageUrl = () => {
  const url = designSystem.imageUrls[currentImageIndex % designSystem.imageUrls.length];
  currentImageIndex++;
  return url;
};

const App = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Home', href: '#hero' },
    { name: 'About Us', href: '#about' },
    { name: 'Services', href: '#services' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'Contact', href: '#contact' },
  ];

  const renderLogo = (className = "h-10 w-auto") => {
    if (designSystem.logoUrl) {
      return <img src={designSystem.logoUrl} alt={`${designSystem.businessName} Logo`} className={className} />;
    }
    return <span className="font-heading text-2xl font-bold text-primary">{designSystem.businessName}</span>;
  };

  const commonSectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <div className="min-h-screen bg-background text-text font-body">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="fixed top-0 left-0 w-full bg-background shadow-md z-50 py-4 px-6 md:px-12"
      >
        <nav className="container mx-auto flex justify-between items-center">
          <a href="#hero" className="flex-shrink-0">
            {renderLogo()}
          </a>
          <div className="hidden md:flex space-x-8">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="font-heading text-text hover:text-primary transition duration-300">
                {link.name}
              </a>
            ))}
          </div>
          <div className="md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-text focus:outline-none">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
          </div>
        </nav>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-background py-4 flex flex-col items-center space-y-4 shadow-lg"
          >
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} onClick={() => setIsMobileMenuOpen(false)} className="font-heading text-text hover:text-primary transition duration-300 text-lg">
                {link.name}
              </a>
            ))}
          </motion.div>
        )}
      </motion.header>

      <main className="pt-20"> {/* Padding to account for fixed header */}
        {/* Hero Section - Split Screen (Text Left/Image Right) */}
        <motion.section
          data-section="hero"
          initial="hidden"
          animate="visible"
          variants={commonSectionVariants}
          className="flex flex-col md:flex-row min-h-[calc(100vh-80px)] items-center bg-background"
        >
          <div className="md:w-1/2 p-8 md:p-16 flex flex-col justify-center items-start text-left">
            <motion.h1
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="font-heading text-5xl md:text-6xl font-extrabold text-primary mb-6 leading-tight"
            >
              Your Brightest Smile, Our Gentle Care.
            </motion.h1>
            <motion.p
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="font-body text-lg md:text-xl text-text mb-8"
            >
              {userContext.businessSummary}
            </motion.p>
            <motion.a
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              href="#contact"
              className="px-8 py-4 bg-buttonBackground text-buttonText font-heading font-semibold rounded-full shadow-lg hover:bg-primary-dark transition duration-300 ease-in-out transform hover:scale-105"
            >
              Book Your Free Consultation
            </motion.a>
          </div>
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="md:w-1/2 h-96 md:h-[calc(100vh-80px)] bg-cover bg-center"
            style={{ backgroundImage: `url(${getNextImageUrl()})` }}
          >
            <div className="w-full h-full bg-black/10"></div> {/* Subtle overlay for image */}
          </motion.div>
        </motion.section>

        {/* About Us Section */}
        <motion.section
          data-section="about"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={commonSectionVariants}
          className="py-16 md:py-24 bg-background px-6 md:px-12"
        >
          <div className="container mx-auto max-w-6xl">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-center text-primary mb-12">
              Why Choose Smile Dental Care?
            </h2>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7 }}
                className="space-y-6"
              >
                <p className="font-body text-lg text-text leading-relaxed">
                  At {designSystem.businessName}, we are dedicated to providing an exceptional and comfortable dental journey. Our approach combines advanced technology with a deeply patient-centric philosophy, ensuring every visit is reassuring and effective.
                </p>
                <ul className="space-y-4">
                  {userContext.sellingPoints.map((point, index) => (
                    <motion.li
                      key={index}
                      initial={{ x: -20, opacity: 0 }}
                      whileInView={{ x: 0, opacity: 1 }}
                      viewport={{ once: true, amount: 0.5 }}
                      transition={{ delay: 0.1 * index, duration: 0.5 }}
                      className="flex items-start text-text font-body text-lg"
                    >
                      <Award className="h-6 w-6 text-secondary mr-3 flex-shrink-0" />
                      <span>{point}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7 }}
                className="relative h-80 md:h-96 w-full rounded-xl overflow-hidden shadow-xl"
              >
                <img src={getNextImageUrl()} alt="Modern Dental Clinic" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Lightbulb className="h-16 w-16 text-accent opacity-80" />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Services Section */}
        <motion.section
          data-section="services"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={commonSectionVariants}
          className="py-16 md:py-24 bg-accent px-6 md:px-12"
        >
          <div className="container mx-auto max-w-6xl text-center">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-primary mb-12">
              Our Comprehensive Dental Services
            </h2>
            <p className="font-body text-lg text-text max-w-3xl mx-auto mb-12">
              We offer a wide range of dental services, from routine check-ups to advanced treatments, all delivered with the latest technology and a gentle touch.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { icon: Stethoscope, title: "Root Canal Therapy (RCT)", description: "Specialized and effective treatment to save damaged teeth, performed with precision and comfort." },
                { icon: Smile, title: "Cosmetic Dentistry", description: "Enhance your smile with teeth whitening, veneers, and other aesthetic treatments." },
                { icon: HeartHandshake, title: "General Check-ups & Cleaning", description: "Regular preventative care to maintain optimal oral health and prevent future issues." },
                { icon: Lightbulb, title: "Advanced Laser Dentistry", description: "Utilizing low-level laser for smooth, painless, and efficient procedures." },
                { icon: Award, title: "Dental Implants", description: "Permanent solutions for missing teeth, restoring function and aesthetics." },
                { icon: Phone, title: "Emergency Dental Care", description: "Prompt and compassionate care for unexpected dental pain or injuries." },
              ].map((service, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ delay: 0.1 * index, duration: 0.5 }}
                  className="bg-background p-8 rounded-lg shadow-md flex flex-col items-center text-center hover:shadow-xl transition-shadow duration-300"
                >
                  <service.icon className="h-12 w-12 text-secondary mb-4" />
                  <h3 className="font-heading text-2xl font-semibold text-primary mb-3">{service.title}</h3>
                  <p className="font-body text-text">{service.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Testimonials Section */}
        <motion.section
          data-section="testimonials"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={commonSectionVariants}
          className="py-16 md:py-24 bg-background px-6 md:px-12"
        >
          <div className="container mx-auto max-w-6xl text-center">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-primary mb-12">
              What Our Patients Say
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {userContext.reviews.map((review, index) => (
                <motion.div
                  key={index}
                  initial={{ y: 50, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ delay: 0.1 * index, duration: 0.6 }}
                  className="bg-accent p-8 rounded-lg shadow-md flex flex-col items-center text-center hover:shadow-xl transition-shadow duration-300"
                >
                  <img
                    src={getNextImageUrl()}
                    alt={review.author}
                    className="w-20 h-20 rounded-full object-cover mb-4 border-4 border-primary"
                  />
                  <p className="font-body text-lg italic text-text mb-4">"{review.quote}"</p>
                  <p className="font-heading text-primary font-semibold">- {review.author}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Contact Section */}
        <motion.section
          data-section="contact"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={commonSectionVariants}
          className="py-16 md:py-24 bg-primary text-buttonText px-6 md:px-12"
        >
          <div className="container mx-auto max-w-6xl text-center">
            <h2 className="font-heading text-4xl md:text-5xl font-bold mb-12">
              Get In Touch With Us
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7 }}
                className="space-y-6 text-left"
              >
                <div className="flex items-start">
                  <MapPin className="h-8 w-8 text-accent mr-4 flex-shrink-0" />
                  <div>
                    <h3 className="font-heading text-2xl font-semibold mb-1">Our Location</h3>
                    <p className="font-body text-lg">{userContext.contactDetails.address}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Phone className="h-8 w-8 text-accent mr-4 flex-shrink-0" />
                  <div>
                    <h3 className="font-heading text-2xl font-semibold mb-1">Call Us</h3>
                    <a href={`tel:${userContext.contactDetails.phone}`} className="font-body text-lg hover:underline">
                      {userContext.contactDetails.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-start">
                  <Mail className="h-8 w-8 text-accent mr-4 flex-shrink-0" />
                  <div>
                    <h3 className="font-heading text-2xl font-semibold mb-1">Our Website</h3>
                    <a href={userContext.contactDetails.website} target="_blank" rel="noopener noreferrer" className="font-body text-lg hover:underline">
                      {userContext.contactDetails.website}
                    </a>
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7 }}
                className="bg-buttonText text-text p-8 rounded-lg shadow-xl"
              >
                <h3 className="font-heading text-2xl font-semibold text-primary mb-6">Send Us a Message</h3>
                <form className="space-y-4">
                  <input type="text" placeholder="Your Name" className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary" />
                  <input type="email" placeholder="Your Email" className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary" />
                  <textarea placeholder="Your Message" rows="5" className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary"></textarea>
                  <button type="submit" className="w-full px-6 py-3 bg-buttonBackground text-buttonText font-heading font-semibold rounded-md shadow-md hover:bg-primary-dark transition duration-300">
                    Send Message
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <motion.footer
        data-section="footer"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8 }}
        className="bg-text text-buttonText py-12 px-6 md:px-12"
      >
        <div className="container mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <a href="#hero" className="inline-block">
              {renderLogo("h-12 w-auto filter brightness-0 invert")} {/* Invert logo for dark background */}
            </a>
            <p className="font-body text-sm leading-relaxed">
              {designSystem.businessName} is dedicated to providing exceptional dental care with a focus on comfort, advanced technology, and patient well-being.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-heading text-xl font-semibold text-primary mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="font-body text-sm hover:text-accent transition duration-300">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-heading text-xl font-semibold text-primary mb-4">Contact & Hours</h3>
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-accent" />
              <p className="font-body text-sm">{userContext.contactDetails.address}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="h-5 w-5 text-accent" />
              <a href={`tel:${userContext.contactDetails.phone}`} className="font-body text-sm hover:text-accent">
                {userContext.contactDetails.phone}
              </a>
            </div>
            {userContext.openingHours && (
              <div className="space-y-2 pt-4">
                <h4 className="font-heading text-lg font-semibold text-accent">Opening Hours:</h4>
                <ul className="font-body text-sm space-y-1">
                  {Object.entries(userContext.openingHours).map(([day, hours]) => (
                    <li key={day} className="flex justify-between">
                      <span>{day}:</span>
                      <span>{hours}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm font-body">
          &copy; {new Date().getFullYear()} {designSystem.businessName}. All rights reserved.
        </div>
      </motion.footer>
    </div>
  );
};

export default App;