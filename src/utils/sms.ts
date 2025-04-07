import path from "path";
import pug from "pug";
import { htmlToText } from "html-to-text";
import AppError from "./error";
import { IUser } from "../models/user/user";
import logger from "./logger";
import Melipayamak from "melipayamak";

interface SMSOptions {
  to: string;
  text: string;
}

class SMS {
  private to: string;
  private firstName: string;
  private url: string;
  private melipayamak: Melipayamak;

  constructor(user: IUser, url: string) {
    this.to = user.phone;
    this.firstName = user.firstName;
    this.url = url;
    this.melipayamak = new Melipayamak(
      process.env.MELIPAYAMAK_USERNAME as string,
      process.env.MELIPAYAMAK_PASSWORD as string
    );
  }

  private send = async (
    template: string,
    subject: string,
    data?: Record<string, unknown>
  ): Promise<void> => {
    try {
      // Render HTML based on pug template
      const html = pug.renderFile(
        path.join(process.cwd(), "src", "views", `${template}.pug`),
        {
          firstName: this.firstName,
          url: this.url,
          subject,
          orderItems: data?.orderItems,
        }
      );

      // Convert HTML to plain text
      const text = htmlToText(html, {
        wordwrap: 130,
      });

      // Define the SMS options
      const smsOptions: SMSOptions = {
        to: this.to,
        text,
      };

      // Send SMS
      await this.sendSMS(smsOptions);
    } catch (error) {
      logger.error(`Error sending SMS to user ${this.to}:`, error);
      throw new AppError("Error Sending SMS", 500);
    }
  };

  private async sendSMS(options: SMSOptions): Promise<void> {
    try {
      const sms = this.melipayamak.sms();
      await sms.send(
        options.to,
        process.env.MELIPAYAMAK_NUMBER as string,
        options.text
      );
      logger.info(`SMS sent successfully to ${options.to}`);
    } catch (error) {
      logger.error("Error sending SMS:", error);
      throw new AppError("Failed to send SMS", 500);
    }
  }

  sendWelcome = async (): Promise<void> => {
    await this.send("welcome", "Welcome to E-Buy family");
  };

  sendVerification = async (): Promise<void> => {
    if (this.url.length <= 6) {
      // If url is actually a verification code
      const text = `Your E-Buy verification code is: ${this.url}\nValid for 15 minutes.`;
      const smsOptions: SMSOptions = {
        to: this.to,
        text,
      };
      await this.sendSMS(smsOptions);
    } else {
      await this.send("verify", "E-Buy Phone Verification");
    }
  };

  sendResetPassword = async (): Promise<void> => {
    await this.send(
      "passwordReset",
      "E-Buy Account Reset Password (valid for 10 min)"
    );
  };

  sendShipped = async (order: Record<string, unknown>): Promise<void> => {
    await this.send("orderShipped", "Order Status Update", order);
  };
}

export default SMS;
