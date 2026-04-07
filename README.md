# 🧾 Divvy – Automatic Bill Splitting App

Divvy is a smart bill-splitting app that makes group payments effortless. Just take a photo of your receipt, let the app automatically process it, and select the items you want to pay for. Divvy handles tax, tip, and totals for everyone. No more awkward Venmo math.

---

## Features

### Receipt Scanning
Upload or take a photo of a receipt. Divvy uses OCR and image processing to:
- Detect items  
- Extract prices  
- Identify tax and tip  
- Calculate the total automatically  

### Smart Item-Based Splitting
Users select the items they ordered, and Divvy:
- Splits shared items evenly  
- Assigns individual items correctly  
- Distributes tax and tip proportionally  

### Fair Payment Calculation
No more guessing. Divvy ensures:
- Everyone pays exactly their share  
- Tax and tip are split fairly  
- The total always matches the receipt  

### Expense Tracking
Divvy keeps track of:
- How much each user has spent  
- Who owes whom  
- Historical spending trends over time  

Perfect for roommates, trips, restaurants, and shared living.

---

## How It Works

1. Take a photo of a receipt  
2. OCR extracts all items and prices  
3. Users select what they ordered  
4. Divvy calculates individual totals  
5. Payments can be settled instantly  

--

## Future Improvements

- Venmo / PayPal / Apple Pay integration  
- Group accounts for roommates and trips and other long-term splits
- AI receipt correction & learning  
- Budgeting and monthly summaries  

---

## Built With

- OCR (Optical Character Recognition) – Google Cloud Vision API
- Computer Vision
- Python / FastAPI (receipt API)
- React / React Native
- Backend API for bill processing
- Database for user expense tracking

---

## Receipt API (Python / FastAPI)

### Setup

```bash
# Create venv and install deps
python -m venv venv
source venv/bin/activate   # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Auth for Google Cloud Vision (choose one):
# 1. Service account: set GOOGLE_APPLICATION_CREDENTIALS to your JSON key path
# 2. Local dev: gcloud auth application-default login
```

### Run

```bash
uvicorn backend.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

### Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/receipts/process` | Upload receipt image → returns items + costs |
| POST | `/api/receipts/parse` | Parse raw OCR text (body: `{"raw_text": "..."}`) |  

---

## 📬 Contact

Built by **beaam**



