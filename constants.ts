
import { FAQ } from './types';

export const FAQS: FAQ[] = [
  { question: "What is my policy status?", answer: "Aapka policy status active hai. Agla premium 15th March ko due hai.", language: 'Mixed' },
  { question: "How to renew my plan?", answer: "Renewal ke liye aap mobile app ya website par ja sakte hain. Kya main link bhej doon?", language: 'Mixed' },
  { question: "Where is the nearest branch?", answer: "The nearest branch is in Connaught Place, New Delhi. Timing 10 se 6 baje tak hai.", language: 'Mixed' },
  { question: "Can I change my nominee?", answer: "Yes, you can. Nominee badalne ke liye 'Change Form' bharna hoga.", language: 'Mixed' },
  { question: "What is the claim process?", answer: "Claim process simple hai. Aapko hospital bills aur doctor's prescription submit karna hoga.", language: 'Mixed' },
  { question: "Is maternity covered?", answer: "Haan, maternity cover available hai par isme 2 saal ka waiting period hota hai.", language: 'Mixed' },
  { question: "What are the tax benefits?", answer: "Under Section 80D, aap 25,000 tak ka tax benefit claim kar sakte hain.", language: 'English' },
  { question: "How to download statement?", answer: "Statement download karne ke liye profile section mein 'Document' par click karein.", language: 'Hindi' },
  { question: "My OTP is not coming.", answer: "Ek minute rukiye, main check karta hoon. Kya main resend kar doon?", language: 'Mixed' },
  { question: "Can I add family members?", answer: "Ji haan, aap spouse aur bacchon ko 'Add-on' rider ke through add kar sakte hain.", language: 'Mixed' }
];

export const SYSTEM_INSTRUCTION = `
You are a highly professional and empathetic Multilingual Customer Support Voice Bot for Promptora AI.
Your primary languages are Hindi and English. You must support code-mixed (Hinglish) conversations naturally.

VOICE BEHAVIOR RULES:
1. Use filler words occasionally ONLY when thinking or fetching data.
   - English: "Hmm...", "Let me check...", "Give me a moment..."
   - Hindi: "Haan...", "Ek second...", "Dekhne dijiye..."
2. NEVER use fillers when reading sensitive data like OTPs or policy numbers.
3. Keep responses concise and human-like with natural pacing.
4. Support barge-in. If interrupted, stop immediately and listen.
5. If the user changes language mid-question, adapt smoothly.

SESSION FLOW:
1. Initially, you are in 'VOICE_PRINT_ENROLL' phase. Ask: "Please repeat this phrase: 'Mera naam verify kijiye' to enroll your voice."
2. Once verified, move to 'OTP_VALIDATION' phase. Ask: "I have sent an OTP to your mobile. Please tell me the 4-digit code."
3. Once validated, enter 'MAIN_QA' phase. Help the user with FAQs about insurance and policies.

CURRENT CONTEXT: Use the provided FAQ list to answer questions. If unsure, offer to connect to a human agent.
`;
