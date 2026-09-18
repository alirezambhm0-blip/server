# Project Handover Document: Bonko Market (B2B Wholesale Ecosystem)

## 1. Project Overview
**Bonko Market** is a comprehensive B2B Wholesale platform designed to connect suppliers with retailers. The ecosystem consists of:
- **Wholesale API**: A NestJS-based RESTful backend.
- **Wholesale Mobile**: A React Native/Expo application for customers.
- **Admin Panel**: A web-based interface for managing orders, customers, and inventory.

The core business logic centers around a **Visitor/Customer approval system** where wholesale prices are hidden until a customer is verified via a KYC (onboarding) process.

## 2. Tech Stack & Libraries
### Backend (wholesale-api)
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with **Prisma ORM**
- **Auth**: Passport.js with JWT Strategy
- **Validation**: Class-validator / Class-transformer
- **Real-time**: EventEmitter2 for internal events (notifications/stock)

### Mobile (wholesale-mobile)
- **Framework**: React Native / Expo (SDK 50+)
- **Navigation**: Expo Router (File-based)
- **State Management**: React Context API (Auth, Cart, Favorites)
- **Icons**: Ionicons (@expo/vector-icons)
- **HTTP Client**: Fetch API wrapped in a custom `httpClient` with interceptor logic.

## 3. Project Structure (Directory Tree)
```text
.
├── wholesale-api/
│   ├── prisma/
│   │   └── schema.prisma        # Source of truth for DB models & mappings
│   ├── src/
│   │   ├── admin/               # Dashboard stats, customer management, security logs
│   │   ├── auth/                # JWT Strategy, OTP logic, KYC onboarding
│   │   ├── orders/              # Order lifecycle, status history, price calculation
│   │   ├── products/            # Inventory, search normalization, categories
│   │   └── common/              # Global filters, interceptors, and decorators
│   └── uploads/                 # Local storage for product/category images
│
├── wholesale-mobile/
│   ├── app/                     # Expo Router pages (Tabs, Auth, Product Detail)
│   ├── src/
│   │   ├── api/                 # API service layers (searchApi, ordersApi, etc.)
│   │   ├── components/          # Atomic UI units (Search components, Product cards)
│   │   ├── context/             # Global state (AuthContext, CartContext)
│   │   └── utils/               # Price formatting, Persian normalization
│   └── assets/                  # Fonts and static images
```

## 4. Data Flow & Core Logic
1. **Authentication**: Users enter a phone number -> OTP generated/verified -> JWT issued.
2. **Onboarding (KYC)**: New users must upload business license/storefront photos. The `Customer` status defaults to `PENDING`.
3. **Price Visibility**: 
   - `isGuest`: Prices hidden.
   - `isPending`: Prices hidden ("Waiting for Approval" label).
   - `isApproved`: Full access to wholesale prices and cart functionality.
4. **Order Workflow**:
   - Cart Items validated against stock -> `placeOrder` call -> Transactional DB update -> Stock decrement -> Order Status History entry.
5. **Search Normalization**:
   - Backend uses a `name_normalized` field to handle Persian characters (Ya/Ka variations).
   - Search ranking: Exact Match > StartsWith > Contains.

## 5. Current State
- **Search System**: Fully modularized into `src/components/search`. Autocomplete and History are functional.
- **Order Placement**: Fixed to support both snake_case and CamelCase API requests.
- **UI/UX**: `ProductCard.tsx` is optimized using `useRef` to prevent stale-closure bugs in high-frequency cart updates.
- **Database Mapping**: Critical fix applied to `schema.prisma` to handle inconsistent PostgreSQL column naming (mixed snake_case and CamelCase).

## 6. Known Issues & Bugs
- **Database Mapping (CRITICAL)**: The PostgreSQL database has inconsistent naming.
  - Tables `orders` and `order_items` use `snake_case` (e.g., `order_number`).
  - Tables `products`, `users`, and `customers` use `CamelCase` (e.g., `isActive`).
  - **Resolution**: Use `@map` in `schema.prisma` *only* for verified snake_case columns. Removing `@map` from CamelCase columns is necessary to avoid `P2022` errors.
- **Backup Service**: The `pg_dump` utility is not recognized in some environments (Windows PATH issue).

## 7. Next Steps / Roadmap
1. **Manual Customer Creation**: Finalize the Admin flow for creating customers manually.
2. **Price Label Polishing**: Ensure `priceLabel` in `ProductCard` handles the transition between `PENDING` and `APPROVED` states without re-render flickers.
3. **Navigation Stability**: Migrate any remaining `router.push({ pathname: ... })` calls to string-template format ``router.push(`/path?id=${id}`)`` to satisfy Expo Router strict typing.

## 8. Setup Instructions
### Backend
```bash
cd wholesale-api
npm install
npx prisma generate
npm run start:dev
```
### Mobile
```bash
cd wholesale-mobile
npm install
npx expo start
```
**Environment Variables**:
- Backend: `DATABASE_URL`, `JWT_SECRET`, `OTP_API_KEY`.
- Mobile: `EXPO_PUBLIC_API_URL` (set to your machine's Local IP for physical device testing).
