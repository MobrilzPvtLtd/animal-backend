# Animal Click - Complete API Documentation & cURL Collection

**Total APIs: 38 Endpoints** across 11 Modules.

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
  "confirmPassword": "Password@123",
  "name": "Jane Doe",
  "username": "janedoe",
  "location": "Durban, South Africa",
  "imagePath": "https://example.com/images/profile.jpg"
}'
```

**Example JSON Response Body:**
```json
{
  "message": "Registration successful",
  "user": {
    "user_id": 3,
    "email": "user@example.com",
    "username": "janedoe",
    "name": "Jane Doe",
    "location": "Durban, South Africa",
    "imagePath": "https://animal-backend-nine.vercel.app/images/profile.jpg",
    "roles": [7]
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
