/**
 * Seed script: creates admin user, sample categories, sample products.
 *
 * Run with:
 *   npx ts-node prisma/seed.ts
 * or (after build):
 *   node dist/prisma/seed.js
 */
import { PrismaClient, UserRole, CustomerStatus } from '@prisma/client';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt'; // bcrypt is in deps already

const prisma = new PrismaClient();

async function main() {
  // 1) Admin user (phone 09000000000 — در صورت نیاز تغییر دهید)
  const adminPhone = process.env.ADMIN_PHONE || '09000000000';
  let adminUser = await prisma.user.findUnique({ where: { phone: adminPhone } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        phone: adminPhone,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    console.log(`✅ Admin user created: ${adminPhone}`);
  } else {
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: UserRole.ADMIN, isActive: true },
    });
    console.log(`ℹ️  Admin user already exists (${adminPhone}), promoted to ADMIN.`);
  }

  // 1.5) ویزیتورهای تستی (اختیاری — برای تست‌های دستی مانند تست IDOR فاز ۵-۱)
  // مانند ادمین: از env خوانده می‌شود و upsert است (اجرای مجدد امن). اگر env خالی باشد چیزی ساخته نمی‌شود (پیش‌فرض امن در production).
  for (const envName of ['VISITOR1_PHONE', 'VISITOR2_PHONE'] as const) {
    const phone = process.env[envName]?.trim();
    if (!phone) continue;
    const existingVisitor = await prisma.user.findUnique({ where: { phone } });
    if (!existingVisitor) {
      await prisma.user.create({ data: { phone, role: UserRole.VISITOR, isActive: true } });
      console.log(`✅ Visitor user created: ${phone} (${envName})`);
    } else if (existingVisitor.role !== UserRole.VISITOR) {
      await prisma.user.update({ where: { id: existingVisitor.id }, data: { role: UserRole.VISITOR, isActive: true } });
      console.log(`ℹ️  Existing user ${phone} promoted to VISITOR.`);
    } else {
      console.log(`ℹ️  Visitor user already exists (${phone}).`);
    }
  }

  // 2) دسته‌بندی‌های نمونه
  const catData = [
    { name: 'مواد غذایی', slug: 'groceries' },
    { name: 'نوشیدنی', slug: 'beverages' },
    { name: 'بهداشتی', slug: 'hygiene' },
    { name: 'تنقلات', slug: 'snacks' },
  ];
  for (const c of catData) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, isActive: true },
      create: { name: c.name, slug: c.slug, isActive: true, sortOrder: 0 },
    });
  }
  const cats = await prisma.category.findMany();
  const groceries = cats.find((c) => c.slug === 'groceries')!;
  const drinks = cats.find((c) => c.slug === 'beverages')!;
  const hygiene = cats.find((c) => c.slug === 'hygiene')!;
  const snacks = cats.find((c) => c.slug === 'snacks')!;

  // 3) محصولات نمونه
  const products = [
    { name: 'روغن مایع سرخ‌کردنی', slug: 'fry-oil', price: 285000, stock: 24, categoryId: groceries.id },
    { name: 'نوشابه گازدار ۱.۵ لیتری', slug: 'soda-1.5', price: 69000, stock: 120, categoryId: drinks.id },
    { name: 'شامپو روزانه ۵۰۰ میلی‌لیتر', slug: 'shampoo-500', price: 125000, stock: 40, categoryId: hygiene.id },
    { name: 'بیسکویت کرمدار', slug: 'cream-biscuit', price: 98000, stock: 0, categoryId: snacks.id },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { price: p.price, stock: p.stock, isActive: true, categoryId: p.categoryId, name: p.name },
      create: {
        name: p.name,
        slug: p.slug,
        price: p.price,
        stock: p.stock,
        isActive: p.stock > 0,
        categoryId: p.categoryId,
        unit: 'CARTON',
        minOrderQty: 1,
        sortOrder: 0,
      },
    });
  }
  console.log('✅ Sample categories/products ensured.');

  // 4) راهنما
  console.log('\n=== How to log in as admin ===');
  console.log(`1) سرور را با \`npm run start:dev\` اجرا کنید.`);
  console.log(`2) از اپ یا با curl، به /auth/request-otp شماره ${adminPhone} را بزنید.`);
  console.log(`   پاسخ (چون NODE_ENV=development) شامل testCode است.`);
  console.log(`3) به /auth/verify-otp بروید تا توکن ادمین دریافت کنید.`);
  console.log(`4) می‌توانید با آن توکن به endpointهای /admin/* یا endpointهای محافظت‌شده با @Roles(ADMIN) دسترسی داشته باشید.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
