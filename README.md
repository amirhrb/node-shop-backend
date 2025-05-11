# E-Buy Backend API

A robust e-commerce backend API built with Node.js, Express, TypeScript, and MongoDB.

## Features

- **Authentication & Authorization**

  - Phone number verification
  - JWT-based authentication
  - Role-based access control (RBAC)
  - Permission management system

- **User Management**

  - User profiles with photo upload
  - Address management
  - Favorites system
  - User roles and permissions

- **Product Management**

  - Product CRUD operations
  - Image upload and processing
  - Product categorization
  - Search and filtering

- **Shopping Features**

  - Cart management
  - Order processing
  - Review system
  - Like/Dislike functionality

- **Security**
  - Input validation
  - Rate limiting
  - CORS protection
  - Secure file uploads

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/db_name
FRONT_END_URL=http://localhost:3000
HASH_SALT=12
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
# Cloudinary
CLOUDINARY_CLOUD_NAME=dp9fuikel
CLOUDINARY_API_KEY=719141447537178
CLOUDINARY_API_SECRET=I7w3FiyF12U3AB45hBKxqK6Z8iA
# Zarinpal Configuration
ZARINPAL_MERCHANT_ID=6131f123-3671-4fca-ab3e-abcf0e09280a
ZARINPAL_IS_SANDBOX=true
# SMS Configuration (Melipayamak)
MELIPAYAMAK_USERNAME=your-melipayamak-username
MELIPAYAMAK_PASSWORD=your-melipayamak-password
MELIPAYAMAK_NUMBER=your-melipayamak-number
# Super Admin Configuration
SUPER_ADMIN_USERNAME=amir
SUPER_ADMIN_FIRST_NAME=amir
SUPER_ADMIN_LAST_NAME=hhh
SUPER_ADMIN_EMAIL=superadmin@dev.com
SUPER_ADMIN_PHONE=09121111111
# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User
ADMIN_EMAIL=admin@dev.com
ADMIN_PHONE=09122222222
```

## Installation

1. Clone the repository:

```bash
git clone https://github.com/amirhrb/node-shop-backend
cd node-shop-backend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. For production:

```bash
npm run build
npm start
```

## API Documentation

The API documentation is available in the Postman collection:

- `shop-api.postman_collection.json`

### Key Endpoints

- **Authentication**

  - `POST /api/v1/users/send-code` - Send verification code
  - `POST /api/v1/users/verify-code` - Verify code and get token
  - `POST /api/v1/users/refresh-token` - Refresh access token

- **User Management**

  - `GET /api/v1/users/me` - Get current user
  - `PATCH /api/v1/users/me` - Update user info
  - `DELETE /api/v1/users/me` - Delete account

- **Profile Management**

  - `GET /api/v1/users/profile` - Get user profile
  - `PATCH /api/v1/users/profile` - Update profile with photo

- **Products**
  - `GET /api/v1/products` - Get all products
  - `POST /api/v1/products` - Create product
  - `GET /api/v1/products/:id` - Get product details
  - `PATCH /api/v1/products/:id` - Update product
  - `DELETE /api/v1/products/:id` - Delete product

## Error Handling

The API implements comprehensive error handling:

1. **Global Error Handler**

   - Catches all unhandled errors
   - Returns appropriate HTTP status codes
   - Provides detailed error messages in development

2. **Process Error Handlers**

   - Uncaught exceptions: Immediate shutdown
   - Unhandled rejections: Graceful shutdown with timeout

3. **Custom Error Types**
   - Validation errors
   - Authentication errors
   - Authorization errors
   - Database errors
   - File upload errors

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run linter
- `npm run format` - Format code

### Code Structure

```
src/
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── seed/          # Database seeding
├── types/         # TypeScript types
├── test/         # Tests
├── utils/         # Utility functions
├── views/         # SMS templates
├── app.ts         # Express app setup
└── server.ts      # Server entry point
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Data design

DBSchema more in: [PDF doc file](/e-commerce.pdf)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
