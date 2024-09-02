const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    try {
        const transporter = nodemailer.createTransport({
            name: 'movya.com',
            host: 'shared67.accountservergroup.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        transporter.verify(function (error, success) {
            if (error) {
                console.log(error);
            }
        });

        const mailOptions = {
            from: `Abhi Movya <${process.env.EMAIL_USERNAME}>`,
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

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

module.exports = sendEmail;