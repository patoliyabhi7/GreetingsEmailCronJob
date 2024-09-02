const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const mailOptions = {
            to: options.email,
            subject: options.subject,
            text: options.message,
        };

        // Conditionally add attachments
        if (options.fileName && options.filePath) {
            mailOptions.attachments = [{
                filename: options.fileName,
                path: options.filePath
            }];
        }

        // Send the email
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

module.exports = sendEmail;