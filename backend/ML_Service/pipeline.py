"""
Grievance Redressal Semantic Clustering Pipeline
------------------------------------------------
Level 1: Automatic Category Classification (8 categories)
Level 2: Guided Semantic Sub-clustering + Dynamic Fallback
"""

import json
import os
import re
from typing import List, Dict, Any, Tuple
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import AgglomerativeClustering

# Predefined categories and their specific sub-problem definitions (bilingual: English + Hinglish)
CATEGORY_TAXONOMY = {
    "Hostel & mess": {
        "Mess Food Quality & Hygiene": "mess food quality taste cold oily insects raw food dinner lunch breakfast mess khana kharab kacha roti hygiene plate canteen meal thanda khana",
        "Hostel Water Supply & Geyser Repair": "hostel geyser broken hot water supply pani nhi aa rha winter washroom tap dry shower cold water tank geyser repair",
        "Hostel Room Maintenance & Electrical": "hostel room fan light broken electricity power cut switch socket warden cleaning bed furniture cupboard door"
    },
    "academics": {
        "Faculty Lectures & Syllabus Completion": "faculty teacher professor missing classes lectures syllabus incomplete syllabus nhi hua padha nhi rhe course late",
        "Timetable & Attendance Discrepancy": "timetable clash attendance shortage medical leave not marked class clash subject elective",
        "Lab Practical & Equipment Issues": "lab practical experiments equipment not working computers software practical exam"
    },
    "exams and results": {
        "Admit Card & Hall Ticket Issues": "admit card hall ticket download error photo blank payment pending exam permit card roll number slip",
        "Result Declaration & Marksheet Discrepancy": "exam result wrong marks backlog withheld revaluation rechecking delay grade card marksheet update",
        "Exam Schedule & Date Sheet Clash": "exam timetable clash date sheet examination timing clash morning evening exam schedule"
    },
    "fees and scholarship": {
        "Fee Payment & Receipt Status": "semester fee payment debited money cut receipt not generated transaction failed portal error fee paid fees challan",
        "Scholarship Approval & Disbursement": "scholarship NSP form verification pending approval scholarship amount delay concession freeship",
        "Late Fee Fine & Concession": "late fee penalty fine waiver installment request finance office dues clearance"
    },
    "infrastructure": {
        "Campus WiFi & Internet Connectivity": "campus wifi internet net router slow speed dead connection disconnecting library range band padha hai red light",
        "Classroom AC, Projector & Smartboards": "classroom projector lamp broken AC cooling fan not working mic benches lecture hall speaker",
        "Campus Sanitation & Cleanliness": "washroom dirty toilet cleaning hygiene water cooler drinking water contaminated dustbins"
    },
    "transport": {
        "College Bus Route Delay & Timings": "college bus late delay morning route bus timing missed lecture driver bus arrived late",
        "Bus Pass Renewal & Verification": "bus pass renewal id card concession pass counter verification",
        "Bus Overcrowding & Standing Space": "bus overcrowding rush no space to sit standing dangerous seat missing"
    },
    "harassment & safety": {
        "Ragging & Bullying Incident (CRITICAL)": "ragging by seniors forced ragging bullying harassment abuse threat outside gate senior torture",
        "Campus Night Safety & Dark Pathways": "girls hostel dark pathway streetlights off broken unsafe at night security guards missing lighting"
    },
    "other": {
        "Lost & Found Campus Property": "lost id card found wallet keys purse missing identity card umbrella bag",
        "Events, Sports & General Queries": "sports ground gym fest event registration general query admin office"
    }
}

class GrievanceEngine:
    def __init__(self, model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"):
        self.model_name = model_name
        self._model = None
        self.category_names = list(CATEGORY_TAXONOMY.keys())
        self._taxonomy_embeddings = None

    def _load_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                print(f"Loading SentenceTransformer: {self.model_name}...")
                self._model = SentenceTransformer(self.model_name)
                print("Model loaded successfully.")
            except Exception as e:
                print(f"SentenceTransformer load failed: {e}. Falling back to TF-IDF.")
                self._model = "TFIDF_FALLBACK"

    def get_embeddings(self, texts: List[str]) -> np.ndarray:
        self._load_model()
        if self._model != "TFIDF_FALLBACK":
            return self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        else:
            from sklearn.feature_extraction.text import TfidfVectorizer
            vec = TfidfVectorizer(ngram_range=(1, 2))
            all_anchors = [desc for cat_dict in CATEGORY_TAXONOMY.values() for desc in cat_dict.values()]
            vec.fit(all_anchors + texts)
            mat = vec.transform(texts).toarray()
            norms = np.linalg.norm(mat, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            return mat / norms

    def _ensure_embeddings(self):
        if self._taxonomy_embeddings is None:
            self._load_model()
            tax_embs = {}
            for cat, subtopics in CATEGORY_TAXONOMY.items():
                tax_embs[cat] = {}
                for topic_name, desc in subtopics.items():
                    emb = self.get_embeddings([desc])[0]
                    tax_embs[cat][topic_name] = emb / np.linalg.norm(emb)
            self._taxonomy_embeddings = tax_embs

    def classify_category(self, text: str) -> Dict[str, Any]:
        """
        Level 1: Classify complaint text into one of the 8 categories based on maximum sub-topic similarity.
        """
        self._ensure_embeddings()
        text_emb = self.get_embeddings([text])[0]
        text_emb = text_emb / (np.linalg.norm(text_emb) + 1e-9)

        cat_scores = {}
        cat_best_subtopics = {}

        for cat, subtopics in self._taxonomy_embeddings.items():
            best_sub_sim = -1.0
            best_sub_name = None
            for sub_name, sub_emb in subtopics.items():
                sim = float(np.dot(text_emb, sub_emb))
                if sim > best_sub_sim:
                    best_sub_sim = sim
                    best_sub_name = sub_name
            
            cat_scores[cat] = round(best_sub_sim, 4)
            cat_best_subtopics[cat] = (best_sub_name, best_sub_sim)

        best_cat = max(cat_scores.items(), key=lambda x: x[1])[0]
        confidence = cat_scores[best_cat]

        # Low confidence fallback to 'other'
        if confidence < 0.20:
            best_cat = "other"

        return {
            "predicted_category": best_cat,
            "confidence": round(max(0.0, confidence), 3),
            "matched_subtopic": cat_best_subtopics[best_cat][0],
            "all_scores": cat_scores
        }

    def cluster_complaints(self, complaints: List[Dict[str, Any]], guided_threshold: float = 0.22) -> Dict[str, Any]:
        """
        Level 2: Group complaints by category, then cluster into semantic problems with counts.
        """
        self._ensure_embeddings()

        if not complaints:
            return {cat: {"total_complaints": 0, "total_clusters": 0, "clusters": []} for cat in self.category_names}

        # Step 1: Assign categories to any unassigned complaint
        for c in complaints:
            if "category" not in c or not c["category"]:
                cls_res = self.classify_category(c["text"])
                c["category"] = cls_res["predicted_category"]
                c["category_confidence"] = cls_res["confidence"]

        # Step 2: Bucket complaints by category
        categorized = {cat: [] for cat in self.category_names}
        for c in complaints:
            cat = c.get("category", "other")
            if cat not in categorized:
                cat = "other"
            categorized[cat].append(c)

        result_dashboard = {}

        # Step 3: Cluster inside each category
        for cat, items in categorized.items():
            if not items:
                result_dashboard[cat] = {
                    "total_complaints": 0,
                    "total_clusters": 0,
                    "clusters": []
                }
                continue

            texts = [it["text"] for it in items]
            embs = self.get_embeddings(texts)

            subtopics = self._taxonomy_embeddings.get(cat, {})
            clusters_by_topic = {}
            unmatched_indices = []

            for idx, (item, emb) in enumerate(zip(items, embs)):
                best_topic = None
                best_sim = -1.0
                for topic_name, topic_emb in subtopics.items():
                    sim = float(np.dot(emb, topic_emb))
                    if sim > best_sim:
                        best_sim = sim
                        best_topic = topic_name

                if best_topic and best_sim >= guided_threshold:
                    if best_topic not in clusters_by_topic:
                        clusters_by_topic[best_topic] = {
                            "items": [],
                            "embs": []
                        }
                    clusters_by_topic[best_topic]["items"].append(item)
                    clusters_by_topic[best_topic]["embs"].append(emb)
                else:
                    unmatched_indices.append(idx)

            formatted_clusters = []
            cluster_id_counter = 1

            # Format guided sub-topic clusters
            for topic_name, cluster_data in clusters_by_topic.items():
                c_items = cluster_data["items"]
                c_embs = np.array(cluster_data["embs"])
                
                if len(c_items) == 1:
                    medoid_idx = 0
                else:
                    sim_mat = cosine_similarity(c_embs)
                    medoid_idx = int(np.argmax(sim_mat.sum(axis=1)))
                
                formatted_clusters.append({
                    "cluster_id": cluster_id_counter,
                    "topic": topic_name,
                    "count": len(c_items),
                    "representative_text": c_items[medoid_idx]["text"],
                    "complaints": c_items
                })
                cluster_id_counter += 1

            # Unmatched/novel complaints: cluster using Agglomerative
            if unmatched_indices:
                if len(unmatched_indices) == 1:
                    single = items[unmatched_indices[0]]
                    formatted_clusters.append({
                        "cluster_id": cluster_id_counter,
                        "topic": "General Issue / Specific Case",
                        "count": 1,
                        "representative_text": single["text"],
                        "complaints": [single]
                    })
                    cluster_id_counter += 1
                else:
                    unmatched_embs = embs[unmatched_indices]
                    agg = AgglomerativeClustering(
                        n_clusters=None,
                        distance_threshold=0.40,
                        metric="cosine",
                        linkage="average"
                    )
                    sub_labels = agg.fit_predict(unmatched_embs)
                    groups = {}
                    for u_idx, lab in enumerate(sub_labels):
                        if lab not in groups:
                            groups[lab] = []
                        groups[lab].append(unmatched_indices[u_idx])

                    for lab, item_indices in groups.items():
                        group_items = [items[i] for i in item_indices]
                        rep_text = group_items[0]["text"]
                        formatted_clusters.append({
                            "cluster_id": cluster_id_counter,
                            "topic": f"Specific: {rep_text[:35]}...",
                            "count": len(group_items),
                            "representative_text": rep_text,
                            "complaints": group_items
                        })
                        cluster_id_counter += 1

            # Sort clusters by complaint count descending
            formatted_clusters.sort(key=lambda x: x["count"], reverse=True)

            result_dashboard[cat] = {
                "total_complaints": len(items),
                "total_clusters": len(formatted_clusters),
                "clusters": formatted_clusters
            }

        return result_dashboard

if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    with open("sample_data.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    engine = GrievanceEngine()
    results = engine.cluster_complaints(data)
    
    print("\n=== CLUSTERING RESULTS SUMMARY ===")
    for cat, info in results.items():
        if info["total_complaints"] > 0:
            print(f"\n[{cat.upper()}] - {info['total_complaints']} complaints in {info['total_clusters']} clusters:")
            for cl in info["clusters"]:
                print(f"   * {cl['topic']} ({cl['count']} users reported)")
                for comp in cl["complaints"]:
                    print(f"      - [{comp['student_name']} - {comp['student_id']}]: \"{comp['text']}\"")
