const fs = require('fs');

const htmlFile = 'projects_source/1774970985000/dist/privacy-policy.html';
const content = fs.readFileSync(htmlFile, 'utf8');

const newMain = `    <main>
        <!-- Hero Section -->
        <section data-section="hero" class="relative py-20 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-r from-primary/90 via-secondary/80 to-accent/90"></div>
            <div class="relative z-10 container mx-auto px-6 text-center">
                <h1 class="font-heading text-4xl md:text-6xl font-extrabold text-white leading-tight mb-4" data-aos="fade-up">Privacy Policy</h1>
                <p class="text-white/80 text-lg md:text-xl max-w-2xl mx-auto" data-aos="fade-up" data-aos-delay="100">Our commitment to protecting your personal information</p>
            </div>
        </section>

        <!-- Policy Content -->
        <section data-section="policy" class="py-20">
            <div class="container mx-auto px-6">
                <div class="max-w-4xl mx-auto bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl p-8 md:p-12" data-aos="fade-up">

                    <div class="mb-10">
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">At Smile Dental Care, we take the privacy and security of our patients' personal information very seriously. This Privacy Policy outlines how we collect, use, and protect the information that we receive from our patients through our website and other digital channels.</p>
                        
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">We are committed to adhering to all applicable laws and regulations governing the privacy of personal information in India and under international laws, including but not limited to the Indian Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, the General Data Protection Regulation (GDPR), and any other relevant privacy laws. Our policy is designed to protect your privacy and comply with all relevant international laws, including those that apply to Indian patients, foreign patients, children, and vulnerable patients.</p>

                        <p class="text-lg text-text/80 mb-6 leading-relaxed">By accessing or using our website, you agree to the terms of this Privacy Policy. If you do not agree to the terms of this Privacy Policy, please do not use our website.</p>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">Collection and Use of Personal Information</h2>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">We collect personal information from our patients and users in a variety of ways, including when they visit our website, book appointments, and fill out forms. The personal information we collect may include name, address, email address, phone number, date of birth, health history, and insurance information.</p>
                        <p class="text-lg text-text/80 mb-4 leading-relaxed">We use the personal information we collect for the following purposes:</p>
                        <ul class="list-disc pl-6 text-lg text-text/80 space-y-3 mb-6">
                            <li>To provide dental care services to our patients, including diagnosis, treatment, and follow-up care.</li>
                            <li>To communicate with our patients and users, including sending appointment reminders, responding to inquiries, and providing information about our services.</li>
                            <li>To process payments for our services, including verifying insurance coverage and billing patients.</li>
                            <li>To comply with legal and regulatory requirements, including maintaining patient records and reporting to health authorities.</li>
                        </ul>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">Sharing of Personal Information</h2>
                        <p class="text-lg text-text/80 mb-4 leading-relaxed">We do not sell, rent, or trade personal information with third parties for their marketing purposes. However, we may share personal information with the following types of third parties:</p>
                        <ul class="list-disc pl-6 text-lg text-text/80 space-y-3 mb-6">
                            <li>Service providers who perform services on our behalf, such as billing and insurance processing, IT support, and marketing.</li>
                            <li>Health authorities or other government agencies as required by law or to protect public health.</li>
                            <li>Our professional advisors, such as lawyers and accountants.</li>
                            <li>Other healthcare providers who are involved in the patient's care, such as referring dentists or medical specialists.</li>
                        </ul>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">Protection of Personal Information</h2>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">We take appropriate measures to protect your personal information from unauthorized access, use, or disclosure. We limit access to your personal information to those who need to know it for the purposes of providing our services. We also require our service providers to implement appropriate security measures to protect your personal information.</p>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">However, no system can be completely secure, and we cannot guarantee the security of your personal information. Therefore, we cannot be held responsible for any unauthorized access or use of your personal information.</p>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">Retention of Personal Information</h2>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">We will retain your personal information only as long as necessary to fulfill the purposes for which it was collected or as required by law. When your personal information is no longer necessary for these purposes, we will securely delete or anonymize it.</p>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">Cookies and Other Tracking Technologies</h2>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">We use cookies and other tracking technologies to collect information about how our patients use our website. This information helps us to improve our website and to provide better services to our patients. We may use third-party service providers to help us analyse our website usage. These service providers may use cookies and other tracking technologies to collect information about our patients' website usage.</p>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">International Transfer of Personal Information</h2>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">If our patients are located outside India, their personal information may be transferred to and processed in India. By providing us with their personal information, our patients consent to this transfer and processing.</p>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">Children's Privacy</h2>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">We do not knowingly collect personal information from children under the age of 16 without the consent of a parent or legal guardian. If we become aware that we have collected personal information from a child under the age of 16 without parental consent, we will delete the information as soon as possible.</p>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">Vulnerable Patients' Privacy</h2>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">We are committed to protecting the privacy of vulnerable patients, including elderly patients, patients with disabilities, and patients with mental health conditions. We may require additional consent or assistance from a legal guardian or caregiver in collecting and using personal information for vulnerable patients.</p>
                    </div>

                    <div class="mb-10">
                        <h2 class="font-heading text-2xl md:text-3xl font-bold mb-4 text-primary">Updates to this Privacy Policy</h2>
                        <p class="text-lg text-text/80 mb-6 leading-relaxed">We may update this Privacy Policy from time to time to reflect changes in our information practices or legal requirements. We will post the updated Privacy Policy on our website as and when deemed necessary.</p>
                    </div>

                </div>
            </div>
        </section>
    </main>`;

const updatedContent = content.replace(/<main>[\s\S]*?<\/main>/, newMain);
fs.writeFileSync(htmlFile, updatedContent, 'utf8');
console.log('Updated privacy-policy.html');
