from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import re
from collections import defaultdict

# Pipeline import - agar error de toh try-except me hai
try:
    from pipeline import process_complaints, get_embeddings
    PIPELINE_AVAILABLE = True
except:
    PIPELINE_AVAILABLE = False

app = Flask(__name__, static_folder='.')
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# --- Load Sample Data ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'sample_data.json')

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

# --- Category Prediction Logic (Exact 8 NyayaStack Categories) ---
CATEGORY_KEYWORDS = {
    "Harassment & Safety": [
        "harassment", "ragging", "bullying", "safety", "abuse", "threat", "tease", "touch",
        "unsafe", "stalking", "security", "guard", "cctv", "eve teasing", "intimidation"
    ],
    "Hostel & Mess": [
        "hostel", "mess", "food", "canteen", "room", "cleanliness", "hygiene", "keeda",
        "paani", "warden", "geyser", "washroom tap", "bed", "water supply"
    ],
    "Exams & Results": [
        "exam", "paper", "leak", "marks", "result", "marksheet", "admit card", "hall ticket",
        "cheat", "cheating", "grade", "grading", "revaluation", "backlog", "datesheet", "paper leak"
    ],
    "Academics": [
        "faculty", "attendance", "class", "subject", "teacher", "professor", "syllabus",
        "lecture", "timetable", "lab", "practical", "study", "assignment", "project guide"
    ],
    "Fees & Scholarship": [
        "fee", "fees", "scholarship", "payment", "receipt", "refund", "dues", "fine",
        "penalty", "challan", "nsp", "money debited", "freeship"
    ],
    "Infrastructure": [
        "light", "fan", "bench", "building", "washroom", "toilet", "road", "wifi",
        "internet", "projector", "ac", "water cooler", "lift", "door broken", "desk"
    ],
    "Transport": [
        "bus", "transport", "shuttle", "van", "driver", "route", "parking", "bus pass", "bus timing"
    ],
    "Other": []
}

def predict_category(text):
    text_lower = text.lower()
    # Priority check for exam leak / harassment keywords first
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return category
    return "Other"

# --- Clustering Logic ---
def get_clusters_data():
    complaints = load_data()
    if PIPELINE_AVAILABLE and complaints:
        try:
            return process_complaints(complaints)
        except:
            pass
    
    # Fallback simple clustering
    clusters = defaultdict(list)
    for c in complaints:
        cat = c.get('category') or predict_category(c.get('description',''))
        clusters[cat].append(c)
    
    result = []
    for cat, items in clusters.items():
        result.append({
            "title": cat,
            "count": len(items),
            "complaints": items
        })
    return result

# --- ROUTES ---

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_file(filename):
    return send_from_directory('.', filename)

@app.route('/api/predict', methods=['POST'])
def api_predict():
    data = request.get_json() or {}
    description = data.get('description', '')
    if not description:
        return jsonify({"category": "Other", "priority": "Medium (Standard SLA 48h)"})
    
    category = predict_category(description)
    
    # Auto-detect priority
    priority = "Medium (Standard SLA 48h)"
    desc_lower = description.lower()
    emergency = False
    if any(w in desc_lower for w in ["leak", "ragging", "threat", "harass", "abuse", "fire", "emergency", "unsafe"]):
        priority = "High (Strict SLA 24h)"
        if any(w in desc_lower for w in ["ragging", "threat", "fire", "emergency", "violence"]):
            emergency = True

    print(f"[PREDICT] '{description[:35]}...' -> Category: {category} | Priority: {priority}")
    return jsonify({
        "category": category,
        "priority": priority,
        "emergency": emergency
    })

@app.route('/api/clusters', methods=['GET'])
def api_clusters():
    clusters = get_clusters_data()
    return jsonify(clusters)

@app.route('/api/complaints', methods=['GET'])
def api_complaints():
    data = load_data()
    return jsonify(data)

@app.route('/api/file-complaint', methods=['POST'])
def api_file_complaint():
    new_complaint = request.get_json()
    complaints = load_data()
    # Auto assign category if not provided
    if 'category' not in new_complaint or not new_complaint['category']:
        new_complaint['category'] = predict_category(new_complaint.get('description',''))
    
    complaints.append(new_complaint)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(complaints, f, indent=2)
    
    return jsonify({"status": "success", "category": new_complaint['category']})

if __name__ == '__main__':
    print("==========================================")
    print("  NyayaStack AI Grievance Engine (Port 5000) ")
    print("==========================================")
    print(f"Pipeline Engine: {'Available' if PIPELINE_AVAILABLE else 'Keyword Baseline'}")
    print(f"Categories Configured: {len(CATEGORY_KEYWORDS)} categories")
    print(f"Data Loaded: {len(load_data())} complaints in database")
    print("Ready to accept requests on http://127.0.0.1:5000/api/predict")
    app.run(debug=False, port=5000, host='0.0.0.0')
