# Animal Click - Complete API Documentation & cURL Collection

**Total APIs: 59 Endpoints** across 18 Modules.

* **Live Base URL:** `https://animal-backend-nine.vercel.app/api`
* **Local Base URL:** `http://localhost:3000/api`

---

## 🔐 1. Authentication Module (2 APIs)

### 1.1 Super Admin / User Login
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/auth/login`
* **Tokens sent in HTTP Response Headers:**
  - `Authorization: Bearer <access_token>`
  - `access-token: <access_token>`
  - `refresh-token: <refresh_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/auth/login' \
--header 'Content-Type: application/json' \
--data '{
  "email": "superadmin@animal.com",
  "password": "Admin@123"
}'
```

**Example JSON Response Body:**
```json
{
  "message": "Login successful",
  "user": {
    "user_id": 1,
    "email": "superadmin@animal.com",
    "username": "superadmin",
    "name": "Super",
    "surname": "Admin",
    "roles": [1]
  }
}
```

### 1.2 User Registration / Sign Up
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/auth/signup`
* **Tokens sent in HTTP Response Headers:**
  - `Authorization: Bearer <access_token>`
  - `access-token: <access_token>`
  - `refresh-token: <refresh_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/auth/signup' \
--header 'Content-Type: application/json' \
--data '{
  "email": "user@example.com",
  "password": "Password@123",
  "confirm_password": "Password@123",
  "full_name": "Jane Doe",
  "username": "janedoe",
  "location": "Noida",
  "roleName": "Guest",
  "profile_image_url": "https://example.com/images/profile.jpg"
}'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "user_id": 15,
    "auth_user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "user_name": "janedoe",
    "name": "Jane",
    "surname": "Doe",
    "full_name": "Jane Doe",
    "profile_image_url": "https://example.com/images/profile.jpg",
    "user_type": "Guest",
    "phone": null,
    "location": "Noida",
    "latitude": 28.5355,
    "longitude": 77.3910
  },
  "session": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "v1.mc...",
    "expires_in": 3600,
    "token_type": "bearer"
  }
}
```

---

### 1.3 Fetch & Update Logged-In User Profile (`/api/v1/auth/me`)
* **Method:** `GET` / `PATCH` / `PUT` / `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/auth/me`
* **Headers:**
  - `Authorization: Bearer <user_token>`

> **Description:** 
> - **`GET`**: Returns logged-in user profile, role names, permissions, profile image, and **full subscription status & plan details**.
> - **`PATCH` / `PUT` / `POST`**: Updates user profile. Supports `name` (or `full_name`), `user_name` (or `username`), `surname`, `phone`, `bio`, `gender`, `static_location` (or `location` / `address`), and profile image file upload under key `avatar`, `profile_image_url`, `image`, or `file`.

```bash
# 1. Fetch Profile & Subscription Status (GET)
curl --location 'https://animal-backend-nine.vercel.app/api/v1/auth/me' \
--header 'Authorization: Bearer YOUR_USER_TOKEN'

# 2. Update Profile (PATCH/PUT/POST JSON)
curl --location --request PATCH 'https://animal-backend-nine.vercel.app/api/v1/auth/me' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "name": "Yash",
  "username": "yash_tyagi",
  "phone": "1234567890",
  "bio": "Hi there!",
  "address": "Ghaziabad",
  "gender": "Male"
}'

# 3. Update Profile with Avatar Image Upload (Multipart Form-Data)
curl --location --request PATCH 'https://animal-backend-nine.vercel.app/api/v1/auth/me' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--form 'name="Yash"' \
--form 'username="yash_tyagi"' \
--form 'phone="1234567890"' \
--form 'bio="Hi there!"' \
--form 'address="Ghaziabad"' \
--form 'gender="Male"' \
--form 'avatar=@"/path/to/image.jpg"'
```

**Example JSON Response Body:**
```json
{
  "profile": {
    "user_id": 1,
    "user_name": "Priyanka",
    "name": "Priyanka",
    "surname": "Developer",
    "email": "priyanka@example.com",
    "phone": "0123456789",
    "profile_image_url": "https://example.com/avatars/user.jpg",
    "is_verified": true,
    "subscription_status": "active",
    "subscription_plan": "MONTHLY_99",
    "subscription_expires_at": "2026-09-30T18:00:00.000Z",
    "is_subscribed": true,
    "subscription_plan_details": {
      "subscription_plan_id": 1,
      "plan_code": "MONTHLY_99",
      "name": "Monthly Plan",
      "description": "Subscribe to list your places, manage rescues, and access the provider dashboard.",
      "price": 99.00,
      "currency": "ZAR",
      "billing_cycle": "monthly",
      "duration_days": 30,
      "features": [
        "List up to 5 places",
        "Basic Analytics",
        "Support Access"
      ],
      "is_active": true
    },
    "user_type": "Owner",
    "user_roles": [
      {
        "role_id": 1,
        "roles": {
          "role_id": 1,
          "name": "Owner",
          "description": "System Owner"
        }
      }
    ],
    "permissions": []
  },
  "subscription": {
    "is_subscribed": true,
    "subscription_status": "active",
    "subscription_plan": "MONTHLY_99",
    "subscription_expires_at": "2026-09-30T18:00:00.000Z",
    "plan_details": {
      "subscription_plan_id": 1,
      "plan_code": "MONTHLY_99",
      "name": "Monthly Plan",
      "description": "Subscribe to list your places, manage rescues, and access the provider dashboard.",
      "price": 99.00,
      "currency": "ZAR",
      "billing_cycle": "monthly",
      "duration_days": 30,
      "features": [
        "List up to 5 places",
        "Basic Analytics",
        "Support Access"
      ],
      "is_active": true
    }
  },
  "is_subscribed": true,
  "roleIds": [1],
  "roleNames": ["Owner"],
  "permissionNames": []
}
```

---

## 🗺️ 2. Google Places Module (2 APIs)

### 2.1 Places Autocomplete Search
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/places?input=Durban`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/places?input=Durban'
```

### 2.2 Place Details
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/places/details?place_id=ChIJmY1zZ5489sERXfL7rV5y5q8`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/places/details?place_id=ChIJmY1zZ5489sERXfL7rV5y5q8'
```

---

## 🏥 3. Veterinarians (Vets) Module (5 APIs)

### 3.1 Get All Vets
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/vets'
```

### 3.2 Get Single Vet By ID
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/vets/1'
```

### 3.3 Create New Vet
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/vets' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Durban Animal Care Vet",
  "email": "contact@durbanvet.com",
  "phone": "+27315550199",
  "emergency_number": "+27829991122",
  "address": "45 Umhlanga Rocks Drive",
  "city": "Durban",
  "state": "KZN",
  "zip_code": "4001"
}'
```

### 3.4 Update Vet
* **Method:** `PUT`
```bash
curl --location --request PUT 'https://animal-backend-nine.vercel.app/api/vets/1' \
--header 'Content-Type: application/json' \
--data '{
  "phone": "+27315550200",
  "is_active": true
}'
```

### 3.5 Delete Vet
* **Method:** `DELETE`
```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/vets/1'
```

---

## 🐾 4. Breeders Module (5 APIs)

### 4.1 Get All Breeders
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/breeders'
```

### 4.2 Get Single Breeder
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/breeders/1'
```

### 4.3 Create Breeder
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/breeders' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Golden Retriever Breeders SA",
  "email": "info@goldenbreeders.co.za",
  "phone": "+27821234567",
  "address": "12 Farm Road",
  "city": "Cape Town",
  "state": "Western Cape"
}'
```

### 4.4 Update Breeder
* **Method:** `PUT`
```bash
curl --location --request PUT 'https://animal-backend-nine.vercel.app/api/breeders/1' \
--header 'Content-Type: application/json' \
--data '{
  "phone": "+27829876543"
}'
```

### 4.5 Delete Breeder
* **Method:** `DELETE`
```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/breeders/1'
```

---

## 🏞️ 5. Pet-Friendly Places Module (5 APIs)

### 5.1 Get All Pet-Friendly Places
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/pet-friendly-places'
```

### 5.2 Get Single Place
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/pet-friendly-places/1'
```

### 5.3 Create Pet-Friendly Place
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/pet-friendly-places' \
--header 'Content-Type: application/json' \
--data '{
  "name": "The Dog Friendly Cafe",
  "category": "Cafe & Restaurant",
  "address": "100 Beach Road",
  "phone": "+27312223344",
  "website": "https://dogfriendlycafe.com"
}'
```

### 5.4 Update Pet-Friendly Place
* **Method:** `PUT`
```bash
curl --location --request PUT 'https://animal-backend-nine.vercel.app/api/pet-friendly-places/1' \
--header 'Content-Type: application/json' \
--data '{
  "phone": "+27319998877"
}'
```

### 5.6 Contribute Pet-Friendly Place (Public / Guest Submission)
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/places/contribute`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/places/contribute' \
--form 'name="Kirstenbosch Tea Garden"' \
--form 'place_type="Cafe & Restaurant"' \
--form 'address="Rhodes Dr, Newlands, Cape Town"' \
--form 'description="Pet-friendly outdoor cafe with beautiful mountain views."' \
--form 'phone="+27 21 799 8782"' \
--form 'website="https://example.com"' \
--form 'latitude="-33.987"' \
--form 'longitude="18.432"' \
--form 'image=@"/path/to/photo.jpg"'
```

---

## ✂️ 6. Service Categories Module (5 APIs)

### 6.1 Get All Service Categories
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/service-categories'
```

### 6.2 Get Single Service Category
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/service-categories/1'
```

### 6.3 Create Service Category
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/service-categories' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Pet Daycare",
  "description": "Daycare and play facilities for pets",
  "icon": "🐶",
  "color": "#3B82F6",
  "sort_order": 7
}'
```

### 6.4 Update Service Category
* **Method:** `PUT`
```bash
curl --location --request PUT 'https://animal-backend-nine.vercel.app/api/service-categories/1' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Premium Pet Grooming"
}'
```

### 6.5 Delete Service Category
* **Method:** `DELETE`
```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/service-categories/1'
```

---

## 🐕 7. Animal Types & Breeds Module (5 APIs)

### 7.1 Get All Animal Types
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/animal-types'
```

### 7.2 Create Animal Type
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/animal-types' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Dog",
  "description": "Canine species",
  "icon": "🐕",
  "sort_order": 1
}'
```

### 7.3 Get All Breeds
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/breeds'
```

### 7.4 Create Breed
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/breeds' \
--header 'Content-Type: application/json' \
--data '{
  "animal_type_id": 1,
  "name": "German Shepherd",
  "description": "Large working dog breed"
}'
```

### 7.5 Delete Breed
* **Method:** `DELETE`
```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/breeds/1'
```

---

## 📅 8. Events Module (5 APIs)

### 8.1 Get All Events
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/events'
```

### 8.2 Get Single Event
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/events/1'
```

### 8.3 Create Event
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/events' \
--header 'Content-Type: application/json' \
--data '{
  "title": "Annual Pet Expo 2026",
  "description": "The largest pet expo in the city",
  "start_date": "2026-09-01 10:00:00",
  "end_date": "2026-09-02 18:00:00",
  "location": "Durban Exhibition Centre"
}'
```

### 8.4 Update Event
* **Method:** `PUT`
```bash
curl --location --request PUT 'https://animal-backend-nine.vercel.app/api/events/1' \
--header 'Content-Type: application/json' \
--data '{
  "title": "Updated Pet Expo 2026"
}'
```

### 8.5 Delete Event
* **Method:** `DELETE`
```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/events/1'
```

---

## 💳 9. Transactions Module (2 APIs)

### 9.1 Get All Transactions
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/transactions'
```

### 9.2 Create Transaction
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/transactions' \
--header 'Content-Type: application/json' \
--data '{
  "user_id": 1,
  "amount": 499.00,
  "status": "completed",
  "payment_method": "stripe"
}'
```

---

## 👤 10. Users Module (4 APIs)

### 10.1 Get All Users
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/users'
```

### 10.2 Get Single User By ID
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/users/1'
```

### 10.3 Create New User
* **Method:** `POST`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/users' \
--header 'Content-Type: application/json' \
--data '{
  "email": "user@animal.com",
  "name": "John",
  "surname": "Doe",
  "password": "Password123",
  "phone": "+27820001122"
}'
```

### 10.4 Update User
* **Method:** `PUT`
```bash
curl --location --request PUT 'https://animal-backend-nine.vercel.app/api/users/1' \
--header 'Content-Type: application/json' \
--data '{
  "name": "John Updated"
}'
```

---

## 🛡️ 11. Roles & Permissions Module (3 APIs)

### 11.1 Get All System Roles
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/roles'
```

### 11.2 Get All Permissions
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/permissions'
```

### 11.3 Get All Boost Packages
* **Method:** `GET`
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/boost-packages'
```

---

## 🎉 12. Events & Event Categories Module (10 APIs)

### 12.1 Get All Events (Upcoming & Past)
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/events`
* **Query Parameters (Optional):**
  - `search`: Search events by title (`?search=dog`)
  - `approved_only=true`: Filter approved events
  - `active_only=true`: Filter active events

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/events?approved_only=true&active_only=true'
```

**Example JSON Response Body:**
```json
{
  "upcoming": [
    {
      "event_id": 1,
      "title": "Annual Pet Adoption Fair 2026",
      "description": "Join us for a wonderful pet adoption day with free health checks.",
      "event_date": "2026-09-15T10:00:00.000Z",
      "end_date": "2026-09-15T17:00:00.000Z",
      "venue": "Central Community Park",
      "image_url": "https://example.com/images/event1.jpg",
      "price": 0,
      "max_attendees": 500,
      "current_attendees": 120,
      "is_active": true,
      "is_approved": true,
      "user_id": 1,
      "event_category_id": 2,
      "location": {
        "location_id": 5,
        "address": "Central Community Park, Main Street, Delhi",
        "latitude": "28.6139",
        "longitude": "77.2090"
      },
      "event_category": {
        "event_category_id": 2,
        "name": "Adoption Camp",
        "icon": "Heart",
        "color": "#FF5733"
      }
    }
  ],
  "past": []
}
```

### 12.2 Get Single Event By ID
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/events/1`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/events/1'
```

**Example JSON Response Body:**
```json
{
  "event": {
    "event_id": 1,
    "title": "Annual Pet Adoption Fair 2026",
    "description": "Join us for a wonderful pet adoption day with free health checks.",
    "event_date": "2026-09-15T10:00:00.000Z",
    "end_date": "2026-09-15T17:00:00.000Z",
    "venue": "Central Community Park",
    "image_url": "https://example.com/images/event1.jpg",
    "price": 0,
    "max_attendees": 500,
    "current_attendees": 120,
    "is_active": true,
    "is_approved": true,
    "location": {
      "location_id": 5,
      "address": "Central Community Park, Main Street, Delhi"
    },
    "event_category": {
      "event_category_id": 2,
      "name": "Adoption Camp"
    }
  }
}
```

### 12.3 Create Event (JSON Request Body)
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/events`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <user_access_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/events' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
--data '{
  "title": "Grand Dog Show 2026",
  "description": "Showcase your dogs and win exciting prizes!",
  "event_date": "2026-10-20T09:00:00Z",
  "end_date": "2026-10-20T18:00:00Z",
  "venue": "City Stadium",
  "address": "City Stadium, MG Road, Mumbai",
  "latitude": "19.0760",
  "longitude": "72.8777",
  "event_category_id": 1,
  "price": 250,
  "max_attendees": 300,
  "image_url": "https://example.com/images/dogshow.jpg",
  "images": [
    "https://example.com/images/dogshow1.jpg",
    "https://example.com/images/dogshow2.jpg"
  ]
}'
```

**Example JSON Response Body:**
```json
{
  "event": {
    "event_id": 12,
    "title": "Grand Dog Show 2026",
    "description": "Showcase your dogs and win exciting prizes!",
    "event_date": "2026-10-20T09:00:00Z",
    "venue": "City Stadium",
    "is_active": true,
    "is_approved": false,
    "user_id": 1,
    "event_category_id": 1,
    "location_id": 8,
    "created_at": "2026-08-10T11:45:00.000Z"
  }
}
```

### 12.4 Create Event (Multipart Form-Data with Direct Image Upload)
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/events`
* **Headers:**
  - `Authorization: Bearer <user_access_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/events' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
--form 'title="Pet Health & Vaccination Drive"' \
--form 'description="Free rabies vaccination drive for dogs and cats."' \
--form 'event_date="2026-11-05T10:00:00Z"' \
--form 'venue="St. John School Ground"' \
--form 'address="St. John School Ground, Sector 15, Gurgaon"' \
--form 'event_category_id="3"' \
--form 'file=@"/path/to/event_banner.jpg"'
```

### 12.5 Update Event
* **Method:** `PATCH`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/events?event_id=12`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_or_owner_token>`

```bash
curl --location --request PATCH 'https://animal-backend-nine.vercel.app/api/v1/events?event_id=12' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "title": "Grand Dog & Cat Show 2026",
  "is_approved": true,
  "price": 300
}'
```

**Example JSON Response Body:**
```json
{
  "event": {
    "event_id": 12,
    "title": "Grand Dog & Cat Show 2026",
    "is_approved": true,
    "price": 300,
    "updated_at": "2026-08-10T11:46:00.000Z"
  }
}
```

### 12.6 Delete Event
* **Method:** `DELETE`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/events?event_id=12`
* **Headers:**
  - `Authorization: Bearer <admin_or_owner_token>`

```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/v1/events?event_id=12' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

**Example JSON Response Body:**
```json
{
  "success": true
}
```

### 12.7 Get All Event Categories
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/event-categories`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/event-categories'
```

**Example JSON Response Body:**
```json
{
  "categories": [
    {
      "event_category_id": 1,
      "name": "Pet Competitions & Shows",
      "description": "Dog shows, agility contests, and cat beauty pageants",
      "icon": "Trophy",
      "color": "#FFC300",
      "created_at": "2026-01-10T00:00:00.000Z"
    },
    {
      "event_category_id": 2,
      "name": "Adoption & Rescue Camps",
      "description": "Find your new furry best friend",
      "icon": "Heart",
      "color": "#FF5733",
      "created_at": "2026-01-10T00:00:00.000Z"
    }
  ]
}
```

### 12.8 Create Event Category
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/event-categories`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/event-categories' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "name": "Pet Vaccination & Health Drive",
  "description": "Medical drives and health checkups for animals",
  "icon": "Stethoscope",
  "color": "#28A745"
}'
```

**Example JSON Response Body:**
```json
{
  "category": {
    "event_category_id": 5,
    "name": "Pet Vaccination & Health Drive",
    "description": "Medical drives and health checkups for animals",
    "icon": "Stethoscope",
    "color": "#28A745",
    "created_at": "2026-08-10T11:47:00.000Z"
  }
}
```

### 12.9 Update Event Category
* **Method:** `PATCH`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/event-categories?event_category_id=5`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_token>`

```bash
curl --location --request PATCH 'https://animal-backend-nine.vercel.app/api/v1/event-categories?event_category_id=5' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "name": "Pet Health & Wellness Drive",
  "color": "#17A2B8"
}'
```

**Example JSON Response Body:**
```json
{
  "category": {
    "event_category_id": 5,
    "name": "Pet Health & Wellness Drive",
    "description": "Medical drives and health checkups for animals",
    "icon": "Stethoscope",
    "color": "#17A2B8"
  }
}
```

### 12.10 Delete Event Category
* **Method:** `DELETE`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/event-categories?event_category_id=5`
* **Headers:**
  - `Authorization: Bearer <admin_token>`

```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/v1/event-categories?event_category_id=5' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

**Example JSON Response Body:**
```json
{
  "success": true
}
```

---

## 🚀 13. Boost Packages & Active Boosted Listings Module (9 APIs)

### 13.1 Get Active Booster Packages List
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boost-packages?active_only=true`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/boost-packages?active_only=true'
```

**Example JSON Response Body:**
```json
{
  "packages": [
    {
      "boost_package_id": 1,
      "name": "Silver Boost (7 Days)",
      "description": "Featured placement at the top of search results for 7 days",
      "duration_days": 7,
      "price": 199.00,
      "is_active": true,
      "created_at": "2026-01-10T00:00:00.000Z"
    },
    {
      "boost_package_id": 2,
      "name": "Gold Boost (30 Days)",
      "description": "Premium homepage & category top banner placement for 30 days",
      "duration_days": 30,
      "price": 599.00,
      "is_active": true,
      "created_at": "2026-01-10T00:00:00.000Z"
    }
  ]
}
```

### 13.2 Get All Booster Packages (Including Inactive)
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boost-packages`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/boost-packages'
```

### 13.3 Create New Booster Package
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boost-packages`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/boost-packages' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "name": "Platinum Lifetime Boost",
  "description": "Top priority listing across all app categories",
  "duration_days": 90,
  "price": 1499.00,
  "is_active": true
}'
```

**Example JSON Response Body:**
```json
{
  "package": {
    "boost_package_id": 3,
    "name": "Platinum Lifetime Boost",
    "description": "Top priority listing across all app categories",
    "duration_days": 90,
    "price": 1499.00,
    "is_active": true,
    "created_at": "2026-08-10T12:00:00.000Z"
  }
}
```

### 13.4 Update Booster Package
* **Method:** `PATCH`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boost-packages?boost_package_id=3`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_token>`

```bash
curl --location --request PATCH 'https://animal-backend-nine.vercel.app/api/v1/boost-packages?boost_package_id=3' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "price": 1299.00,
  "is_active": true
}'
```

### 13.5 Delete Booster Package (Soft Delete)
* **Method:** `DELETE`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boost-packages?boost_package_id=3`
* **Headers:**
  - `Authorization: Bearer <admin_token>`

```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/v1/boost-packages?boost_package_id=3' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

---

### 13.6 Get Active Boosted Entities / Listings
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boosted?active_only=true`
* **Query Parameters (Optional):**
  - `active_only=true`: Sirf currently active boosts list karne ke liye
  - `entity_type`: Filter by type (`service_provider`, `vet`, `breeder`, `pet_friendly_place`)

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/boosted?active_only=true'
```

**Example JSON Response Body:**
```json
{
  "boosts": [
    {
      "entity_boost_id": 1,
      "boost_package_id": 2,
      "entity_type": "service_provider",
      "service_provider_id": 5,
      "start_date": "2026-08-01T00:00:00.000Z",
      "end_date": "2026-08-31T23:59:59.000Z",
      "is_active": true,
      "boost_packages": {
        "name": "Gold Boost (30 Days)",
        "duration_days": 30,
        "price": 599.00
      },
      "service_providers": {
        "service_provider_id": 5,
        "name": "Priyanka Pet Care & Grooming"
      }
    }
  ]
}
```

### 13.7 Apply Boost to an Entity (Service Provider, Vet, Breeder, Place)
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boosted`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/boosted' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "boost_package_id": 2,
  "entity_type": "service_provider",
  "service_provider_id": 5
}'
```

**Example JSON Response Body:**
```json
{
  "boost": {
    "entity_boost_id": 2,
    "boost_package_id": 2,
    "entity_type": "service_provider",
    "service_provider_id": 5,
    "start_date": "2026-08-10T12:00:00.000Z",
    "end_date": "2026-09-09T12:00:00.000Z",
    "is_active": true,
    "created_at": "2026-08-10T12:00:00.000Z"
  }
}
```

### 13.8 Update Boost Status / End Date
* **Method:** `PATCH`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boosted?entity_boost_id=2`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_token>`

```bash
curl --location --request PATCH 'https://animal-backend-nine.vercel.app/api/v1/boosted?entity_boost_id=2' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "is_active": false
}'
```

### 13.9 Delete Boost Record
* **Method:** `DELETE`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/boosted?entity_boost_id=2`
* **Headers:**
  - `Authorization: Bearer <admin_token>`

```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/v1/boosted?entity_boost_id=2' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

---

## 14. Event Reminder API

### 14.1 Set Event Reminder
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/event-reminder`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <user_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/event-reminder' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "event_id": 5
}'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "message": "Event reminder set successfully",
  "reminder": {
    "reminder_id": 1,
    "event_id": 5,
    "user_id": 12,
    "created_at": "2026-08-10T12:18:00.000Z"
  }
}
```

---

### 14.2 Get Event Reminder Status by `event_id`
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/event-reminder?event_id=5`
* **Headers:**
  - `Authorization: Bearer <user_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/event-reminder?event_id=5' \
--header 'Authorization: Bearer YOUR_USER_TOKEN'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "is_reminder_set": true,
  "reminder": {
    "reminder_id": 1,
    "event_id": 5,
    "user_id": 12,
    "created_at": "2026-08-10T12:18:00.000Z"
  }
}
```

---

### 14.3 Automated Cron Job Worker (Runs Daily for 1-Day Before Event Mail)
* **Method:** `GET` / `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/cron/event-reminders`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/cron/event-reminders'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "message": "Successfully processed 2 event reminders for tomorrow",
  "reminders_found": 2,
  "emails_sent": 2
}
```

---

## 15. Donation Campaigns APIs

### 15.1 Get Donation Campaigns
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/donations`
* **Query Params:**
  - `visible_only` (Optional, e.g. `true`)
  - `search` (Optional, e.g. `Rescue`)

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/donations?visible_only=true'
```

**Example JSON Response Body:**
```json
{
  "campaigns": [
    {
      "campaign_id": 1,
      "rescue_centre_id": 2,
      "title": "Help Stray Paws Winter Medical Fund",
      "description": "Providing medical care, food, and shelter for street animals.",
      "monthly_target": 50000.00,
      "visible": true,
      "expires_at": "2026-12-31T23:59:59.000Z",
      "bank_name": "HDFC Bank",
      "account_number": "50100234567890",
      "account_type": "Savings",
      "branch_code_swift": "HDFC0001234",
      "created_at": "2026-08-10T10:00:00.000Z",
      "rescue_centres": {
        "rescue_centre_id": 2,
        "name": "Paws Rescue Care",
        "phone": "9876543210"
      }
    }
  ]
}
```

---

### 15.2 Create Donation Campaign
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/donations`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_or_owner_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/donations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "rescue_centre_id": 2,
  "title": "Help Stray Paws Winter Medical Fund",
  "description": "Providing medical care, food, and shelter for street animals.",
  "monthly_target": 50000,
  "visible": true,
  "expires_at": "2026-12-31T23:59:59Z",
  "bank_name": "HDFC Bank",
  "account_number": "50100234567890",
  "account_type": "Savings",
  "branch_code_swift": "HDFC0001234"
}'
```

**Example JSON Response Body:**
```json
{
  "campaign": {
    "campaign_id": 1,
    "rescue_centre_id": 2,
    "title": "Help Stray Paws Winter Medical Fund",
    "description": "Providing medical care, food, and shelter for street animals.",
    "monthly_target": 50000,
    "visible": true,
    "expires_at": "2026-12-31T23:59:59.000Z",
    "bank_name": "HDFC Bank",
    "account_number": "50100234567890",
    "account_type": "Savings",
    "branch_code_swift": "HDFC0001234",
    "created_at": "2026-08-11T12:00:00.000Z"
  }
}
```

---

### 15.3 Update Donation Campaign
* **Method:** `PATCH`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/donations?campaign_id=1`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_or_owner_token>`

```bash
curl --location --request PATCH 'https://animal-backend-nine.vercel.app/api/v1/donations?campaign_id=1' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "monthly_target": 75000,
  "visible": true
}'
```

**Example JSON Response Body:**
```json
{
  "campaign": {
    "campaign_id": 1,
    "rescue_centre_id": 2,
    "title": "Help Stray Paws Winter Medical Fund",
    "monthly_target": 75000,
    "visible": true
  }
}
```

---

### 15.4 Delete Donation Campaign
* **Method:** `DELETE`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/donations?campaign_id=1`
* **Headers:**
  - `Authorization: Bearer <admin_or_owner_token>`

```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/v1/donations?campaign_id=1' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

**Example JSON Response Body:**
```json
{
  "success": true
}
```

---

## 16. Community Module APIs

### 16.1 Create Community Post (Multiple Images Support)
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/community`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <user_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "title": "Adopt cute puppies!",
  "body": "We have 3 healthy puppies ready for adoption. Please share!",
  "images": [
    "https://example.com/images/puppy1.jpg",
    "https://example.com/images/puppy2.jpg"
  ]
}'
```

**Example JSON Response Body:**
```json
{
  "post": {
    "post_id": 1,
    "user_id": 12,
    "title": "Adopt cute puppies!",
    "body": "We have 3 healthy puppies ready for adoption. Please share!",
    "image_url": "https://example.com/images/puppy1.jpg",
    "images": [
      "https://example.com/images/puppy1.jpg",
      "https://example.com/images/puppy2.jpg"
    ],
    "created_at": "2026-08-12T10:00:00.000Z"
  }
}
```

---

### 16.2 Get All Community Posts / Get My Own Posts
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/community`
* **Headers:**
  - `Authorization: Bearer <user_token>`
* **Query Params:**
  - `user_id` (Optional: pass `me` to fetch only current user's posts, or specific `user_id` e.g. `12`)
  - `search` (Optional: e.g. `adoption`)

> **Note:** Authorization Header (`Bearer <user_token>`) is mandatory so backend can identify the logged-in user and automatically exclude ALL posts created by users blocked by this user.

```bash
# Get all posts (excluding blocked users' posts)
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community' \
--header 'Authorization: Bearer YOUR_USER_TOKEN'

# Get user's own posts
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community?user_id=me' \
--header 'Authorization: Bearer YOUR_USER_TOKEN'
```

**Example JSON Response Body:**
```json
{
  "posts": [
    {
      "post_id": 1,
      "user_id": 12,
      "title": "Adopt cute puppies!",
      "body": "We have 3 healthy puppies ready for adoption. Please share!",
      "image_url": "https://example.com/images/puppy1.jpg",
      "images": [
        "https://example.com/images/puppy1.jpg",
        "https://example.com/images/puppy2.jpg"
      ],
      "likes_count": 5,
      "dislikes_count": 0,
      "comments_count": 2,
      "created_at": "2026-08-12T10:00:00.000Z",
      "users": {
        "user_name": "Developer",
        "profile_image_url": "https://example.com/profile.jpg"
      }
    }
  ]
}
```

---

### 16.3 Like / Dislike Post
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/community/reactions`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <user_token>`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community/reactions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "post_id": 1,
  "reaction": "like"
}'
```

**Example JSON Response Body:**
```json
{
  "likes_count": 6,
  "dislikes_count": 0,
  "reaction": "like"
}
```

---

### 16.4 Share Post API
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/community/share`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <user_token>` (Optional)

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community/share' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "post_id": 1
}'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "message": "Post shared successfully",
  "post_id": 1,
  "share_link": "https://animal-backend-nine.vercel.app/community/posts/1"
}
```

---

### 16.5 Delete Own Post
* **Method:** `DELETE`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/community?post_id=1`
* **Headers:**
  - `Authorization: Bearer <user_token>`

```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/v1/community?post_id=1' \
--header 'Authorization: Bearer YOUR_USER_TOKEN'
```

**Example JSON Response Body:**
```json
{
  "success": true
}
```

---

### 16.6 Block / Unblock User from Community Post (User-Level Only)
* **Method:** `POST` / `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/community/block` or `https://animal-backend-nine.vercel.app/api/v1/users/block`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <user_token>`

> **Note:** Jab koi user kisi community post se user ko block karta hai (`post_id` pass karke), toh backend automatically us post ke author ko block kar deta hai. Iske baad logged-in user ko `GET /api/v1/community` feed mein us blocked user ka koi bhi post kabhi dikhai nahi dega!

```bash
# 1. Block User directly from Community Post (passes post_id)
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community/block' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "post_id": 5,
  "action": "block"
}'

# 2. Block User by blocked_user_id
curl --location 'https://animal-backend-nine.vercel.app/api/v1/users/block' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "blocked_user_id": 15,
  "action": "block"
}'

# 3. Get Blocked Users List
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community/block' \
--header 'Authorization: Bearer YOUR_USER_TOKEN'

# 4. Unblock User
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community/block' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "blocked_user_id": 15,
  "action": "unblock"
}'
```

**Example JSON Response Body (Block from Post):**
```json
{
  "success": true,
  "message": "User Developer blocked successfully from community post",
  "is_blocked": true,
  "blocked_user_id": 15
}
```

---

### 16.7 Get Blocked Community Posts List (for Unblocking)
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/community/blocked-posts`
* **Headers:**
  - `Authorization: Bearer <user_token>`

> **Description:** Yeh API block kiye gaye saare **Community Posts ki List (`post_id`, `title`, `body`, `image_url`, `images`, `user`)** return karti hai.

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/community/blocked-posts' \
--header 'Authorization: Bearer YOUR_USER_TOKEN'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "blocked_posts": [
    {
      "post_id": 1,
      "user_id": 2,
      "title": "Adopt cute puppies!",
      "body": "We have 3 healthy puppies ready for adoption. Please share!",
      "image_url": "https://ndqrrdhjqrhudydnuipd.supabase.co/storage/v1/object/public/animalclickposts/community_posts/1.jpg",
      "images": [
        "https://ndqrrdhjqrhudydnuipd.supabase.co/storage/v1/object/public/animalclickposts/community_posts/1.jpg"
      ],
      "created_at": "2026-08-12T10:00:00.000Z",
      "blocked_at": "2026-08-12T09:20:35.927Z",
      "user": {
        "user_id": 2,
        "user_name": "Subscriber Member",
        "name": "Subscriber",
        "surname": "Member",
        "full_name": "Subscriber Member",
        "profile_image_url": null
      }
    }
  ]
}
```

---

## 🌟 17. Reviews & Profanity Moderation Module (5 APIs)

### 17.1 Get Reviews (Pet-Friendly Places & Service Providers)
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/reviews`
* **Query Parameters (Optional):**
  - `listing_id`: Filter by listing ID (`?listing_id=5`)
  - `listing_type`: Filter by listing type (`?listing_type=service_provider` or `?listing_type=pet_friendly`)
  - `place_id`: Filter by pet-friendly place ID (`?place_id=5`)
  - `service_provider_id`: Filter by service provider ID (`?service_provider_id=3`)

```bash
# 1. Get reviews by listing_id and listing_type for Service Provider
curl --location 'https://animal-backend-nine.vercel.app/api/v1/reviews?listing_id=3&listing_type=service_provider'

# 2. Get reviews by listing_id and listing_type for Pet-Friendly Place
curl --location 'https://animal-backend-nine.vercel.app/api/v1/reviews?listing_id=5&listing_type=pet_friendly'
```

**Example JSON Response Body:**
```json
{
  "reviews": [
    {
      "review_id": 10,
      "user_id": 4,
      "place_id": null,
      "listing_id": "3",
      "listing_type": "service_provider",
      "rating": 5,
      "comment": "Wonderful clinic with exceptionally caring staff!",
      "reviewer_name": "Sarah Jenkins",
      "reviewer_image": "https://example.com/images/sarah.jpg",
      "likes": 3,
      "is_approved": true,
      "created_at": "2026-08-24T10:15:00.000Z"
    }
  ]
}
```

---

### 17.2 Submit Review (Pet-Friendly Places & Service Providers)
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/reviews`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <user_access_token>` (Required)

> **Description:** Single unified endpoint to submit reviews for **both Pet-Friendly Places and Service Providers**. Saves review data using `listing_type` and `listing_id` while ignoring `place_id` (`place_id` goes as `null`).

```bash
# Option A: Submit review for Service Provider
curl --location 'https://animal-backend-nine.vercel.app/api/v1/reviews' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "listing_id": "3",
  "listing_type": "service_provider",
  "rating": 5,
  "comment": "Great grooming service for my dog!",
  "reviewer_name": "Sarah Jenkins"
}'

# Option B: Submit review for Pet-Friendly Place
curl --location 'https://animal-backend-nine.vercel.app/api/v1/reviews' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_USER_TOKEN' \
--data '{
  "listing_id": "5",
  "listing_type": "pet_friendly",
  "rating": 5,
  "comment": "Wonderful place for pet boarding!",
  "reviewer_name": "Sarah Jenkins"
}'
```

**Example JSON Response Body (Success - 201 Created):**
```json
{
  "success": true,
  "message": "Thank you! Your review has been published.",
  "review": {
    "review_id": 11,
    "user_id": 4,
    "place_id": null,
    "listing_id": "3",
    "listing_type": "service_provider",
    "rating": 5,
    "comment": "Great grooming service for my dog!",
    "reviewer_name": "Sarah Jenkins",
    "reviewer_image": null,
    "likes": 0,
    "is_approved": true,
    "created_at": "2026-08-24T11:20:00.000Z"
  },
  "flaggedWords": []
}
```

**Example Error Body (Inappropriate Language Flagged - 400 Bad Request):**
```json
{
  "error": "Review contains inappropriate language",
  "message": "Your review contains inappropriate or rude language. Please remove it before posting.",
  "flaggedWords": ["badword"]
}
```

---

### 17.3 Toggle / Increment Review Like
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/reviews/10/like`

```bash
curl --location --request POST 'https://animal-backend-nine.vercel.app/api/v1/reviews/10/like'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "likes": 4
}
```

---

### 17.4 Update Review (Moderation & Editing)
* **Method:** `PATCH`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/reviews?review_id=10`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_or_owner_token>` (Required: `Admin`, `Owner`, or `Approver` role)

```bash
curl --location --request PATCH 'https://animal-backend-nine.vercel.app/api/v1/reviews?review_id=10' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--data '{
  "is_approved": true,
  "comment": "Updated review text after moderation check",
  "rating": 5
}'
```

**Example JSON Response Body:**
```json
{
  "review": {
    "review_id": 10,
    "user_id": 4,
    "place_id": 5,
    "rating": 5,
    "comment": "Updated review text after moderation check",
    "is_approved": true,
    "updated_at": "2026-08-24T11:30:00.000Z"
  }
}
```

---

### 17.5 Delete Review
* **Method:** `DELETE`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/reviews?review_id=10`
* **Headers:**
  - `Authorization: Bearer <admin_or_owner_token>` (Required: `Admin` or `Owner` role)

```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/v1/reviews?review_id=10' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

**Example JSON Response Body:**
```json
{
  "success": true
}
```

---

## 💳 18. PayFast Payment Integration Module (2 APIs)

### 18.1 Initiate Payment (`/api/v1/payments/payfast/initiate`)
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/payments/payfast/initiate`
* **Local URL:** `http://localhost:3000/api/v1/payments/payfast/initiate`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <access_token>` (Required: Authenticated User)

```bash
curl --location 'http://localhost:3000/api/v1/payments/payfast/initiate' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
--data '{
  "amount": 100.00,
  "item_name": "Pro Plan Subscription",
  "item_description": "30 Days Access to Pro Features",
  "custom_str1": "Pro",
  "custom_str2": "Monthly"
}'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "payment_url": "https://sandbox.payfast.co.za/eng/process?merchant_id=10000100&merchant_key=46f0cd694581a&return_url=http%3A%2F%2Flocalhost%3A3000%2Fdashboard%2Fpayments-billing%3Fpayment%3Dsuccess%26ref%3DPF_1787834522_9821&cancel_url=http%3A%2F%2Flocalhost%3A3000%2Fdashboard%2Fpayments-billing%3Fpayment%3Dcancelled%26ref%3DPF_1787834522_9821&notify_url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fpayments%2Fpayfast%2Fnotify&m_payment_id=PF_1787834522_9821&amount=100.00&item_name=Pro+Plan+Subscription&item_description=30+Days+Access+to+Pro+Features&custom_str1=Pro&custom_str2=Monthly&signature=a5d4e12b8c...",
  "redirect_url": "https://sandbox.payfast.co.za/eng/process?merchant_id=10000100&merchant_key=46f0cd694581a...",
  "transaction_id": 15,
  "payment_reference": "PF_1787834522_9821",
  "payfastUrl": "https://sandbox.payfast.co.za/eng/process",
  "fields": {
    "merchant_id": "10000100",
    "merchant_key": "46f0cd694581a",
    "return_url": "http://localhost:3000/dashboard/payments-billing?payment=success&ref=PF_1787834522_9821",
    "cancel_url": "http://localhost:3000/dashboard/payments-billing?payment=cancelled&ref=PF_1787834522_9821",
    "notify_url": "http://localhost:3000/api/v1/payments/payfast/notify",
    "m_payment_id": "PF_1787834522_9821",
    "amount": "100.00",
    "item_name": "Pro Plan Subscription",
    "signature": "a5d4e12b8c..."
  }
}
```

---

### 18.2 Instant Transaction Notification (ITN) Webhook (`/api/v1/payments/payfast/notify`)
* **Method:** `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/payments/payfast/notify`
* **Local URL:** `http://localhost:3000/api/v1/payments/payfast/notify`
* **Content-Type:** `application/x-www-form-urlencoded`
* **Note:** Automatically called by PayFast servers upon payment completion. Validates signature, verifies transaction with PayFast host, updates Supabase `transactions` status to `completed`, and updates user subscription.

```bash
curl --location 'http://localhost:3000/api/v1/payments/payfast/notify' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'm_payment_id=PF_1787834522_9821' \
--data-urlencode 'pf_payment_id=1082341' \
--data-urlencode 'payment_status=COMPLETE' \
--data-urlencode 'item_name=Pro Plan Subscription' \
--data-urlencode 'amount_gross=100.00' \
--data-urlencode 'signature=a5d4e12b8c...'
```

**Response Body:**
`HTTP 200 OK` ("OK")

---

### 18.3 Check Payment Status (`/api/v1/payments/status`)
* **Method:** `GET` or `POST`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/payments/status`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <user_access_token>`

#### GET Request (Query Parameter):
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/payments/status?ref=PF_1787826795818_8098' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

#### POST Request (JSON Body):
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/payments/status' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
--data '{
  "ref": "PF_1787826795818_8098"
}'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "data": {
    "transaction_id": 15,
    "payment_reference": "PF_1787826795818_8098",
    "status": "completed",
    "is_completed": true,
    "amount": 200,
    "item_name": "Pro Plan Subscription",
    "item_description": "30 Days Access to Pro Features",
    "created_at": "2026-08-27T10:00:00.000Z",
    "updated_at": "2026-08-27T10:05:00.000Z"
  }
}
```

---

## 💳 19. Subscription Plans Module (1 API)

### 19.1 Get Available Subscription Plans (Public Endpoint for Mobile App & Web)
* **Method:** `GET`
* **URL:** `https://animal-backend-nine.vercel.app/api/v1/subscriptions/plans`

```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/subscriptions/plans'
```

**Example JSON Response Body:**
```json
{
  "success": true,
  "plans": [
    {
      "subscription_plan_id": 1,
      "plan_code": "MONTHLY_99",
      "name": "Monthly Plan",
      "description": "Subscribe to list your places, manage rescues, and access the provider dashboard.",
      "price": 99.00,
      "currency": "ZAR",
      "billing_cycle": "monthly",
      "duration_days": 30,
      "features": [
        "List up to 5 places",
        "Basic Analytics",
        "Support Access"
      ],
      "badge_text": null,
      "is_active": true
    },
    {
      "subscription_plan_id": 2,
      "plan_code": "YEARLY_899",
      "name": "Yearly Plan",
      "description": "Subscribe to list your places, manage rescues, and access the provider dashboard.",
      "price": 899.00,
      "currency": "ZAR",
      "billing_cycle": "yearly",
      "duration_days": 365,
      "features": [
        "Unlimited places",
        "Priority Support",
        "2 Months Free",
        "Verified Badge"
      ],
      "badge_text": "MOST POPULAR",
      "is_active": true
    }
  ]
}
```






