import crypto from 'crypto';
import User from '../models/User.js';
import { sendEmailVerificationMail } from './mail.js';
import { clientOrigin } from './clientOrigin.js';

/**
 * @param {{ _id: import('mongoose').Types.ObjectId, email: string, name?: string }} user
 */
export async function issueAndSendEmailVerification(user) {
  const plain = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
  const exp = new Date(Date.now() + 48 * 3600 * 1000);
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerificationTokenHash: hash,
        emailVerificationExpires: exp,
      },
    }
  );
  const verifyUrl = `${clientOrigin()}/verify-email?token=${encodeURIComponent(plain)}`;
  await sendEmailVerificationMail({
    to: user.email,
    name: user.name,
    verifyUrl,
  });
}
