# Animal Click - Complete Vercel Base URL API Reference & cURL Commands

Aap saari APIs ko apni Base URL **`https://animal-backend-nine.vercel.app`** se direct hit kar sakti hain!

---

## 🌐 Base URL Configuration
* **Vercel Base URL:** `https://animal-backend-nine.vercel.app`
* **API Key Header (`apikey` & `Authorization`):** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w`

---

## 1. Authentication APIs (Vercel Base URL)

### 1.1 Sign Up API (POST)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/auth/signup' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Content-Type: application/json' \
--data '{
    "email": "user@example.com",
    "password": "Password@123"
}'
```

### 1.2 Login API (POST)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/auth/token?grant_type=password' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Content-Type: application/json' \
--data '{
    "email": "superadmin@animal.com",
    "password": "Animal@123"
}'
```

---

## 2. Places APIs (Next.js Backend)

### 2.1 Google Places Autocomplete API (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/places?input=Cape%20Town'
```

### 2.2 Google Place Details API (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/places/details?place_id=ChIJ3S-g4y9z5kcR8_g9k'
```

---

## 3. Database Data APIs (Vercel Base URL)

### 3.1 Fetch Users List (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/users?select=*' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w'
```

### 3.2 Create User (POST)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/users' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Content-Type: application/json' \
--data '{
    "name": "John",
    "surname": "Doe",
    "email": "john.doe@example.com",
    "phone": "9876543210"
}'
```

### 3.3 Fetch Veterinarians List (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/veterinarians?select=*' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w'
```

### 3.4 Fetch Service Categories (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/service_categories?select=*' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w'
```

### 3.5 Fetch Events List (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/events?select=*' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w'
```

### 3.6 Create Event (POST)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/events' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Content-Type: application/json' \
--data '{
    "title": "Pet Adoption Fair",
    "description": "Annual animal adoption drive",
    "event_date": "2026-08-15T10:00:00Z",
    "price": 0.00,
    "is_active": true
}'
```

### 3.7 Fetch Breeds List (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/breeds?select=*' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w'
```

### 3.8 Fetch Roles List (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/roles?select=*' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w'
```

### 3.9 Fetch Transactions List (GET)
```bash
curl --location 'https://animal-backend-nine.vercel.app/api/v1/transactions?select=*' \
--header 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eW5tZ2JmamlkdWV3bGRjcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODY1MjIsImV4cCI6MjA5OTg2MjUyMn0.dVwRhnTrqBFb6GzZLlKX5GhuErPMlBlPKkL8PvlQz9w'
```
