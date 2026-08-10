# Animal Click - Complete API Documentation & cURL Collection

**Total APIs: 57 Endpoints** across 13 Modules.

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
curl --location 'https://animal-backend-nine.vercel.app/api/auth/login' \
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

### 5.5 Delete Pet-Friendly Place
* **Method:** `DELETE`
```bash
curl --location --request DELETE 'https://animal-backend-nine.vercel.app/api/pet-friendly-places/1'
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
