import webpush from "web-push";

const vapidKeys = webpush.generateVAPIDKeys();

console.log("\n🔑 VAPID Keys Generated\n");
console.log("Add the following to your .env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your@email.com`);
console.log("\n⚠️  Keep VAPID_PRIVATE_KEY secret. Never commit it.\n");
