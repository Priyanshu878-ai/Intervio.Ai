"""
Structured local Question Generator Engine for Intervio.Ai.
Provides role, difficulty, and type-based interview question generation.
"""

import random
from typing import Any, Dict, List

QUESTION_BANK: Dict[str, Dict[str, Dict[str, List[Dict[str, str]]]]] = {
    "backend": {
        "easy": {
            "technical": [
                {"text": "What is REST and what are its key constraints?", "type": "technical"},
                {"text": "Explain the difference between HTTP GET and POST methods.", "type": "technical"},
                {"text": "What is an index in a relational database and how does it speed up queries?", "type": "technical"},
                {"text": "What is the role of ORM tools like SQLAlchemy in backend applications?", "type": "technical"},
                {"text": "What is the difference between synchronous and asynchronous I/O?", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Tell me about a time you had to debug a difficult production bug.", "type": "behavioral"},
                {"text": "How do you handle disagreement with a colleague about API design?", "type": "behavioral"},
                {"text": "Describe a project where you had to learn a new backend tool quickly.", "type": "behavioral"},
                {"text": "How do you prioritize tasks when faced with tight project deadlines?", "type": "behavioral"},
                {"text": "Tell me about a time you gave constructive code review feedback.", "type": "behavioral"},
            ],
        },
        "medium": {
            "technical": [
                {"text": "Explain connection pooling in PostgreSQL and why it is necessary for web apps.", "type": "technical"},
                {"text": "How do database transactions, ACID properties, and isolation levels work?", "type": "technical"},
                {"text": "What is the difference between process-based and thread-based concurrency?", "type": "technical"},
                {"text": "How would you design a rate-limiting middleware for a REST API?", "type": "technical"},
                {"text": "Explain how JWT token authentication and refresh token rotation work.", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe a situation where a database query degraded performance and how you fixed it.", "type": "behavioral"},
                {"text": "Tell me about an architectural tradeoff decision you had to make in a project.", "type": "behavioral"},
                {"text": "How do you handle scope creep during a backend feature development cycle?", "type": "behavioral"},
                {"text": "Describe a time when you refactored legacy backend code without breaking production.", "type": "behavioral"},
                {"text": "How do you ensure service reliability and monitoring in backend deployments?", "type": "behavioral"},
            ],
        },
        "hard": {
            "technical": [
                {"text": "Design a distributed job queue system handling millions of asynchronous tasks daily.", "type": "technical"},
                {"text": "How do database write-ahead logging (WAL) and consensus algorithms like Raft operate?", "type": "technical"},
                {"text": "Explain database sharding vs. partitioning, including cross-shard join challenges.", "type": "technical"},
                {"text": "How would you prevent race conditions in high-concurrency inventory reservation APIs?", "type": "technical"},
                {"text": "Explain event-driven architecture, event sourcing, and CQRS patterns.", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe a major system outage you investigated, including post-mortem recommendations.", "type": "behavioral"},
                {"text": "Tell me about a time you led a complex database migration with zero downtime.", "type": "behavioral"},
                {"text": "How do you balance technical debt reduction with aggressive product roadmap goals?", "type": "behavioral"},
                {"text": "Describe how you mentored a junior engineer through a difficult architectural failure.", "type": "behavioral"},
                {"text": "Tell me about a time you had to justify a major architectural rewrite to non-technical stakeholders.", "type": "behavioral"},
            ],
        },
    },
    "frontend": {
        "easy": {
            "technical": [
                {"text": "Explain the Virtual DOM concept and how React reconciliation works.", "type": "technical"},
                {"text": "What is the difference between state and props in React?", "type": "technical"},
                {"text": "Explain CSS flexbox vs CSS grid layout principles.", "type": "technical"},
                {"text": "What are semantic HTML tags and why are they important for accessibility?", "type": "technical"},
                {"text": "What is the event loop in JavaScript and how do promises work?", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe a time you collaborated with UI/UX designers to implement complex layouts.", "type": "behavioral"},
                {"text": "How do you ensure cross-browser compatibility when building web interfaces?", "type": "behavioral"},
                {"text": "Tell me about a frontend bug that took significant time to reproduce.", "type": "behavioral"},
                {"text": "How do you approach optimizing page load performance for mobile web users?", "type": "behavioral"},
                {"text": "Describe a time you refactored monolithic frontend component code.", "type": "behavioral"},
            ],
        },
        "medium": {
            "technical": [
                {"text": "How does Next.js handle Server-Side Rendering (SSR) vs Static Site Generation (SSG)?", "type": "technical"},
                {"text": "Explain state management strategies comparing Context API vs Redux / Zustand.", "type": "technical"},
                {"text": "How do web workers and service workers improve web app performance?", "type": "technical"},
                {"text": "Explain CORS issues and how to handle preflight HTTP requests in web apps.", "type": "technical"},
                {"text": "What is code splitting and dynamic import in modern JavaScript bundlers?", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe a time you improved web accessibility (a11y) compliance in a web application.", "type": "behavioral"},
                {"text": "Tell me about a disagreement you had with backend engineers regarding API payloads.", "type": "behavioral"},
                {"text": "How do you prioritize web core vitals performance optimization tasks?", "type": "behavioral"},
                {"text": "Describe a complex frontend feature you delivered under tight timeline constraints.", "type": "behavioral"},
                {"text": "Tell me about a time you introduced TypeScript into an existing JavaScript codebase.", "type": "behavioral"},
            ],
        },
        "hard": {
            "technical": [
                {"text": "Design a micro-frontend architecture for a large enterprise web portal.", "type": "technical"},
                {"text": "How do React Server Components (RSC) streaming and hydration work under the hood?", "type": "technical"},
                {"text": "How would you build a real-time collaborative canvas editor in the browser?", "type": "technical"},
                {"text": "Explain browser rendering pipeline: layout, paint, composite, and GPU acceleration.", "type": "technical"},
                {"text": "Design an offline-first web application data synchronization engine.", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe a critical production incident where frontend memory leaks crashed user browser sessions.", "type": "behavioral"},
                {"text": "Tell me how you established design system guidelines across multiple frontend teams.", "type": "behavioral"},
                {"text": "How do you evaluate and adopt new web frameworks vs maintaining stability?", "type": "behavioral"},
                {"text": "Describe a project where you led the migration of a legacy SPA to Next.js App Router.", "type": "behavioral"},
                {"text": "Tell me about a time you resolved conflicting technical opinions on frontend state architecture.", "type": "behavioral"},
            ],
        },
    },
    "full_stack": {
        "easy": {
            "technical": [
                {"text": "How does a client web app communicate with a FastAPI backend server?", "type": "technical"},
                {"text": "What is the difference between client-side rendering and server-side rendering?", "type": "technical"},
                {"text": "Explain relational database primary keys and foreign keys with an example.", "type": "technical"},
                {"text": "What is JSON and how is it used in web API request/response cycles?", "type": "technical"},
                {"text": "How do environment variables protect API keys and database credentials?", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Tell me about a full-stack feature you built end-to-end from database to UI.", "type": "behavioral"},
                {"text": "How do you split your focus between frontend UI and backend API tasks?", "type": "behavioral"},
                {"text": "Describe a time you debugged an issue spanning both frontend and backend code.", "type": "behavioral"},
                {"text": "How do you ensure UI components gracefully display backend loading and error states?", "type": "behavioral"},
                {"text": "Tell me about a time you received user feedback and updated both API and UI.", "type": "behavioral"},
            ],
        },
        "medium": {
            "technical": [
                {"text": "How do WebSockets enable real-time bidirectional communication between frontend and backend?", "type": "technical"},
                {"text": "Explain how to secure a full-stack application against CSRF and XSS attacks.", "type": "technical"},
                {"text": "Design a file upload pipeline handling video recording from browser to backend storage.", "type": "technical"},
                {"text": "How do database migrations like Alembic synchronize ORM models with PostgreSQL schemas?", "type": "technical"},
                {"text": "What is the role of Docker containers in full-stack local development and deployment?", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe a full-stack feature where API constraints forced a change in UI design.", "type": "behavioral"},
                {"text": "Tell me about a time you optimized both database queries and React render cycles.", "type": "behavioral"},
                {"text": "How do you ensure API contract backward compatibility when deploying full-stack changes?", "type": "behavioral"},
                {"text": "Describe how you managed end-to-end testing across frontend components and API routes.", "type": "behavioral"},
                {"text": "Tell me about a time you took ownership of a feature with underspecified requirements.", "type": "behavioral"},
            ],
        },
        "hard": {
            "technical": [
                {"text": "Design a scalable multimodal AI processing platform with Next.js frontend, FastAPI gateway, and background worker queues.", "type": "technical"},
                {"text": "Explain distributed caching strategies with Redis for full-stack web applications.", "type": "technical"},
                {"text": "How do you architect zero-downtime database schema migrations for high-traffic web applications?", "type": "technical"},
                {"text": "Explain GraphQL vs REST API architectures for complex nested data fetching.", "type": "technical"},
                {"text": "Design a global CDN and API gateway deployment for real-time video interview processing.", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe a time you architected a greenfield full-stack system from scratch under tight deadlines.", "type": "behavioral"},
                {"text": "Tell me about a major production incident involving data inconsistency between frontend and backend.", "type": "behavioral"},
                {"text": "How do you align technical architecture choices with business growth targets?", "type": "behavioral"},
                {"text": "Describe a situation where you had to make trade-offs between rapid prototyping and system scalability.", "type": "behavioral"},
                {"text": "Tell me about a time you led the technical evaluation for choosing a cloud infrastructure provider.", "type": "behavioral"},
            ],
        },
    },
    "machine_learning": {
        "easy": {
            "technical": [
                {"text": "What is the difference between supervised and unsupervised learning?", "type": "technical"},
                {"text": "Explain overfitting vs. underfitting and how to prevent them.", "type": "technical"},
                {"text": "What is the difference between classification and regression tasks?", "type": "technical"},
                {"text": "What is precision, recall, and F1-score?", "type": "technical"},
                {"text": "What is the purpose of train/validation/test dataset splits?", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Tell me about your first machine learning project and what key lesson you learned.", "type": "behavioral"},
                {"text": "How do you handle dirty or missing data in a real-world dataset?", "type": "behavioral"},
                {"text": "Describe a time when a baseline ML model performed better than a complex model.", "type": "behavioral"},
                {"text": "How do you explain model evaluation metrics to non-technical team members?", "type": "behavioral"},
                {"text": "Tell me about a time you had to iterate on feature engineering to boost accuracy.", "type": "behavioral"},
            ],
        },
        "medium": {
            "technical": [
                {"text": "Explain gradient descent, learning rate schedules, and Adam optimizer dynamics.", "type": "technical"},
                {"text": "How do convolutional neural networks (CNNs) process spatial visual features?", "type": "technical"},
                {"text": "What is self-attention mechanism in Transformer architectures?", "type": "technical"},
                {"text": "How do cross-entropy loss and soft-max activation function mathematically?", "type": "technical"},
                {"text": "What is data leakage and how do you prevent it during feature normalization?", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe a situation where an ML model showed bias or unexpected edge-case failure.", "type": "behavioral"},
                {"text": "Tell me about a time you spent significant effort cleaning data vs building models.", "type": "behavioral"},
                {"text": "How do you decide when an ML model is ready for production deployment?", "type": "behavioral"},
                {"text": "Describe a time when an ML experiment failed and how you pivoted your hypothesis.", "type": "behavioral"},
                {"text": "How do you keep up with recent Deep Learning paper advancements and reproduce results?", "type": "behavioral"},
            ],
        },
        "hard": {
            "technical": [
                {"text": "Design a multimodal cross-attention fusion architecture for audio, visual, and text data.", "type": "technical"},
                {"text": "Explain vanishing/exploding gradients in deep networks and techniques like LayerNorm and ResNets to mitigate them.", "type": "technical"},
                {"text": "How would you optimize PyTorch model inference latency using ONNX, TensorRT, or quantization?", "type": "technical"},
                {"text": "Explain contrastive learning and self-supervised pretraining objectives in modern foundation models.", "type": "technical"},
                {"text": "How do you handle extreme class imbalance and hard negative mining in multi-label loss functions?", "type": "technical"},
            ],
            "behavioral": [
                {"text": "Describe how you deployed and monitored an ML model experiencing real-time feature drift in production.", "type": "behavioral"},
                {"text": "Tell me about leading a complex research project with high model uncertainty and tight deadlines.", "type": "behavioral"},
                {"text": "How do you balance GPU compute budget constraints with large-scale model training needs?", "type": "behavioral"},
                {"text": "Describe how you addressed explainability and auditability requirements for a deep learning model.", "type": "behavioral"},
                {"text": "Tell me about a time you advocated against using ML for a problem where heuristics were superior.", "type": "behavioral"},
            ],
        },
    },
}

# Generic fallback pool for unlisted roles
FALLBACK_QUESTIONS: Dict[str, Dict[str, List[Dict[str, str]]]] = {
    "easy": {
        "technical": [
            {"text": "What is object-oriented programming (OOP) and its key pillars?", "type": "technical"},
            {"text": "Explain version control with Git, branching, and pull requests.", "type": "technical"},
            {"text": "What is the difference between compiler and interpreter?", "type": "technical"},
            {"text": "Explain data structures: arrays vs linked lists.", "type": "technical"},
            {"text": "What is unit testing and why is automated testing essential?", "type": "technical"},
        ],
        "behavioral": [
            {"text": "Tell me about a challenging software project you completed recently.", "type": "behavioral"},
            {"text": "How do you prioritize multiple tasks under tight deadlines?", "type": "behavioral"},
            {"text": "Describe a time you collaborated effectively in a software development team.", "type": "behavioral"},
            {"text": "How do you approach learning a new programming language or framework?", "type": "behavioral"},
            {"text": "Tell me about a time you received constructive feedback on your code.", "type": "behavioral"},
        ],
    },
    "medium": {
        "technical": [
            {"text": "Explain time complexity (Big-O notation) with common algorithm examples.", "type": "technical"},
            {"text": "What are microservices vs monolithic architecture tradeoffs?", "type": "technical"},
            {"text": "How do caching mechanisms improve system throughput?", "type": "technical"},
            {"text": "Explain SQL joins and indexing strategy for high performance.", "type": "technical"},
            {"text": "How do CI/CD pipelines automate testing and deployment?", "type": "technical"},
        ],
        "behavioral": [
            {"text": "Describe a situation where technical constraints forced a design compromise.", "type": "behavioral"},
            {"text": "Tell me about a conflict in a development team and how you resolved it.", "type": "behavioral"},
            {"text": "How do you ensure code quality when working on rapid deliverables?", "type": "behavioral"},
            {"text": "Describe a project where you took leadership in defining technical specifications.", "type": "behavioral"},
            {"text": "Tell me about a time you identified and resolved a major performance bottleneck.", "type": "behavioral"},
        ],
    },
    "hard": {
        "technical": [
            {"text": "Design a highly available, fault-tolerant distributed system architecture.", "type": "technical"},
            {"text": "Explain CAP theorem and PACELC theorem in distributed databases.", "type": "technical"},
            {"text": "How would you design a rate-limiting and DDoS mitigation strategy for global APIs?", "type": "technical"},
            {"text": "Explain consensus protocols (Raft, Paxos) and distributed state machines.", "type": "technical"},
            {"text": "How do you design zero-downtime blue-green deployments for distributed microservices?", "type": "technical"},
        ],
        "behavioral": [
            {"text": "Describe a critical production post-mortem failure analysis you spearheaded.", "type": "behavioral"},
            {"text": "Tell me about a time you drove technical vision across multiple engineering teams.", "type": "behavioral"},
            {"text": "How do you balance innovation with technical stability in high-stakes projects?", "type": "behavioral"},
            {"text": "Describe how you managed stakeholder expectations during a high-risk system migration.", "type": "behavioral"},
            {"text": "Tell me about a time you made an architectural decision that failed and what you learned.", "type": "behavioral"},
        ],
    },
}


class QuestionGenerator:
    """
    Local Question Generator Engine that selects ordered, non-duplicate questions
    based on role, difficulty, and interview_type.
    """

    @staticmethod
    def normalize_role(role: str) -> str:
        r = role.lower().strip().replace("-", "_").replace(" ", "_")
        if "back" in r or "backend" in r:
            return "backend"
        if "front" in r or "frontend" in r:
            return "frontend"
        if "full" in r or "fullstack" in r:
            return "full_stack"
        if "ml" in r or "machine" in r or "ai" in r or "learning" in r:
            return "machine_learning"
        if r in QUESTION_BANK:
            return r
        return "default"

    @staticmethod
    def normalize_difficulty(difficulty: str) -> str:
        d = difficulty.lower().strip()
        if d in ["easy", "medium", "hard"]:
            return d
        return "medium"

    @staticmethod
    def normalize_type(interview_type: str) -> str:
        t = interview_type.lower().strip()
        if t in ["technical", "behavioral", "mixed"]:
            return t
        return "mixed"

    def generate(
        self,
        role: str,
        difficulty: str,
        interview_type: str,
        count: int,
        exclude_texts: set = None,
    ) -> List[Dict[str, str]]:
        """
        Generates structured questions avoiding duplicate question texts.
        """
        exclude_texts = exclude_texts or set()
        role_key = self.normalize_role(role)
        diff_key = self.normalize_difficulty(difficulty)
        type_key = self.normalize_type(interview_type)

        # Get role bank or fallback
        if role_key in QUESTION_BANK:
            role_data = QUESTION_BANK[role_key].get(diff_key, QUESTION_BANK[role_key]["medium"])
        else:
            role_data = FALLBACK_QUESTIONS.get(diff_key, FALLBACK_QUESTIONS["medium"])

        tech_pool = role_data.get("technical", [])
        beh_pool = role_data.get("behavioral", [])

        # Filter candidates by excluded texts
        available_tech = [q for q in tech_pool if q["text"] not in exclude_texts]
        available_beh = [q for q in beh_pool if q["text"] not in exclude_texts]

        # If current pool is exhausted, cascade to other difficulties and then to fallback pool
        if not available_tech and not available_beh:
            if role_key in QUESTION_BANK:
                for alt_d in ["medium", "easy", "hard"]:
                    alt_data = QUESTION_BANK[role_key].get(alt_d, {})
                    alt_t = [q for q in alt_data.get("technical", []) if q["text"] not in exclude_texts]
                    alt_b = [q for q in alt_data.get("behavioral", []) if q["text"] not in exclude_texts]
                    if alt_t or alt_b:
                        available_tech, available_beh = alt_t, alt_b
                        break

            if not available_tech and not available_beh:
                for alt_d in ["medium", "easy", "hard"]:
                    alt_data = FALLBACK_QUESTIONS.get(alt_d, {})
                    alt_t = [q for q in alt_data.get("technical", []) if q["text"] not in exclude_texts]
                    alt_b = [q for q in alt_data.get("behavioral", []) if q["text"] not in exclude_texts]
                    if alt_t or alt_b:
                        available_tech, available_beh = alt_t, alt_b
                        break

        # Select candidate sequence based on interview_type
        selected: List[Dict[str, str]] = []

        if type_key == "technical":
            pool = available_tech + available_beh
            for q in pool:
                if len(selected) >= count:
                    break
                selected.append(q)
        elif type_key == "behavioral":
            pool = available_beh + available_tech
            for q in pool:
                if len(selected) >= count:
                    break
                selected.append(q)
        else:  # mixed
            # Alternate between technical and behavioral
            t_idx, b_idx = 0, 0
            while len(selected) < count and (t_idx < len(available_tech) or b_idx < len(available_beh)):
                if t_idx < len(available_tech) and (len(selected) % 2 == 0 or b_idx >= len(available_beh)):
                    selected.append(available_tech[t_idx])
                    t_idx += 1
                elif b_idx < len(available_beh):
                    selected.append(available_beh[b_idx])
                    b_idx += 1

        return selected[:count]


question_generator = QuestionGenerator()
