# لوحة أبو وجيه — نسخة تجريبية مجانية
هذه نسخة اختبارية مناسبة لخطة Render Free.
قيودها: قد تدخل الخدمة في وضع الخمول، ملفاتها المحلية غير دائمة، والجلسات قد تنتهي عند إعادة التشغيل، والجدولة ليست مضمونة أثناء النوم.
لم يتم ربط سلة أو GA4 أو Google Ads أو TikTok أو Snapchat بعد.
ارفع الملفات إلى جذر مستودع GitHub مع مجلد public. أنشئ bcrypt hash محليًا:
`npm install`
`node -e "const b=require('bcryptjs'); console.log(b.hashSync('كلمة-مرور-قوية',12))"`
ضع الناتج في متغير Render باسم VIEWER_PASSWORD_HASH. لا ترفع أي أسرار إلى GitHub.
