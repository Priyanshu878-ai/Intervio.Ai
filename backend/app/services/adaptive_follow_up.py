"""
Answer-Aware Adaptive Follow-up Question Engine for Intervio.Ai.

Generates focused, topic-anchored follow-up questions based on:
1. The candidate's actual answer text and semantic analysis.
2. The current question's topic and key concepts.
3. Identified missing concepts for incomplete/partial answers (probing).
4. Advanced architectural depth for correct/strong answers (deeper).
5. Strict question limit and anti-repetition enforcement.
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Stop words to exclude from concept keyword extraction
STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "could", "did", "do", "does",
    "doing", "down", "during", "each", "few", "for", "from", "further", "had",
    "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
    "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its", "itself",
    "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over",
    "own", "same", "she", "should", "so", "some", "such", "than", "that", "the",
    "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
    "with", "would", "you", "your", "yours", "yourself", "yourselves", "explain",
    "describe", "define", "discuss", "what's", "how's", "give", "example", "examples",
    "like", "think", "guess", "well", "also", "actually", "basically", "literally"
}

TOPIC_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "database_indexing",
        "name": "Database Indexing",
        "trigger_keywords": {"index", "indexes", "indexing", "b-tree", "btree", "hash index", "table scan", "lookup"},
        "subconcepts": {
            "write_overhead": {
                "keywords": {"write", "insert", "update", "delete", "overhead", "penalty", "maintenance", "cost"},
                "probe": "You explained the read performance benefits of B-tree indexes well. How do multiple indexes impact write performance during INSERT, UPDATE, and DELETE operations?",
            },
            "composite_indexing": {
                "keywords": {"composite", "compound", "multiple columns", "leftmost", "column order", "multi-column"},
                "probe": "You covered single-column indexing nicely. How does a composite index function, and why does the column order matter under the leftmost prefix rule?",
            },
            "covering_index": {
                "keywords": {"covering", "index-only", "heap", "include", "payload"},
                "probe": "Building on your explanation: what is a covering index, and how does it avoid fetching data from table heap pages?",
            },
            "clustered_vs_nonclustered": {
                "keywords": {"clustered", "non-clustered", "primary key", "leaf node", "physical order"},
                "probe": "You described index lookups. What is the difference between a clustered index and a non-clustered index in terms of physical disk layout?",
            },
        },
        "general_probe": "You explained how database indexing accelerates queries. What are the key performance trade-offs and memory considerations when indexing heavily updated tables?",
        "deeper_questions": [
            "Going deeper into database internals: how do clustered indexes physically arrange data pages on disk compared to secondary non-clustered indexes?",
            "Under high-concurrency write workloads, how do database engines mitigate index leaf-node fragmentation and page splits in B+ trees?",
            "When would a cost-based query optimizer deliberately choose a sequential table scan over an existing index scan?",
        ],
    },
    {
        "id": "database_transactions_acid",
        "name": "Database Transactions & ACID",
        "trigger_keywords": {"transaction", "transactions", "acid", "atomicity", "consistency", "isolation", "durability", "commit", "rollback"},
        "subconcepts": {
            "isolation_levels": {
                "keywords": {"isolation", "isolation level", "dirty read", "non-repeatable read", "phantom read", "serializable", "read committed", "repeatable read"},
                "probe": "You covered transaction basics. Could you explain the four SQL isolation levels and which specific anomaly (like dirty or phantom reads) each prevents?",
            },
            "durability_wal": {
                "keywords": {"durability", "wal", "write-ahead", "disk", "fsync", "crash", "flush", "recovery"},
                "probe": "You mentioned transaction persistence. How does the database guarantee durability against sudden power failures using Write-Ahead Logging (WAL)?",
            },
            "atomicity_rollback": {
                "keywords": {"atomicity", "all-or-nothing", "all or nothing", "rollback", "undo", "abort"},
                "probe": "You covered part of ACID. How does the database engine maintain atomicity and ensure a safe rollback when a query in the transaction fails halfway through?",
            },
            "consistency_constraints": {
                "keywords": {"consistency", "invariant", "constraint", "foreign key", "valid state"},
                "probe": "You highlighted transaction execution. What role do schema constraints and application invariants play in guaranteeing transaction consistency?",
            },
        },
        "general_probe": "You outlined the basics of ACID transactions. How do isolation levels like Read Committed and Repeatable Read differ in how they handle concurrent transactions?",
        "deeper_questions": [
            "Going deeper into transaction concurrency: how does Multi-Version Concurrency Control (MVCC) enable readers and writers to avoid blocking each other?",
            "In distributed architectures, how does the Two-Phase Commit (2PC) protocol achieve atomicity across multiple distinct databases, and what are its coordinator failure risks?",
            "What is write skew in Repeatable Read isolation, and how do you prevent it without dropping down to full Serializable locking?",
        ],
    },
    {
        "id": "connection_pooling",
        "name": "Connection Pooling",
        "trigger_keywords": {"connection pool", "connection pooling", "pool size", "connections", "pgbouncer", "max_connections"},
        "subconcepts": {
            "pool_sizing": {
                "keywords": {"size", "sizing", "formula", "cpu", "cores", "over-allocation"},
                "probe": "You explained why connection reuse is important. How do you determine the optimal connection pool size for a backend service based on CPU cores and database capacity?",
            },
            "connection_leaks": {
                "keywords": {"leak", "starvation", "timeout", "exhaustion", "leakage", "drain", "held"},
                "probe": "You covered connection management basics. What happens when a backend application leaks connections without returning them to the pool, and how do you detect this in production?",
            },
            "external_poolers": {
                "keywords": {"pgbouncer", "proxy", "external", "multiplexing", "transaction pooling"},
                "probe": "Building on connection pooling: why would you use an external pooler like PgBouncer in front of PostgreSQL instead of relying solely on the application's internal pool?",
            },
        },
        "general_probe": "You described the importance of pooling. What occurs when application traffic spikes and exhausts all available pooled connections, and how should clients handle that backpressure?",
        "deeper_questions": [
            "Going deeper: how does session pooling differ from transaction pooling in external connection managers like PgBouncer, and what features (like prepared statements) does transaction pooling break?",
            "In a serverless or microservice architecture with hundreds of ephemeral containers connecting to a single database, how do you prevent connection storm exhaustion?",
        ],
    },
    {
        "id": "concurrency_async",
        "name": "Concurrency & Async I/O",
        "trigger_keywords": {"concurrency", "async", "asynchronous", "threading", "threads", "multiprocessing", "event loop", "coroutine", "asyncio", "race condition", "gil"},
        "subconcepts": {
            "race_conditions": {
                "keywords": {"race condition", "lock", "mutex", "deadlock", "atomic", "semaphore", "synchronization"},
                "probe": "You explained concurrency concepts. How do race conditions occur when multiple threads access shared mutable state, and what synchronization mechanisms prevent them?",
            },
            "io_vs_cpu": {
                "keywords": {"io-bound", "cpu-bound", "i/o", "blocking", "non-blocking", "throughput"},
                "probe": "You touched on asynchronous execution. What is the fundamental difference between I/O-bound and CPU-bound workloads in terms of whether async or multiprocessing is suitable?",
            },
            "event_loop": {
                "keywords": {"event loop", "await", "coroutine", "single-threaded", "task", "poll", "epoll"},
                "probe": "You mentioned non-blocking I/O. How does an event loop handle thousands of concurrent network connections without creating thousands of OS threads?",
            },
            "gil_python": {
                "keywords": {"gil", "global interpreter lock", "multiprocessing", "cpython"},
                "probe": "You discussed Python concurrency. What is the Global Interpreter Lock (GIL), and how does it affect CPU-bound multithreading in CPython?",
            },
        },
        "general_probe": "You described the benefits of concurrent programming. How do deadlocks occur between competing threads, and how can you design locking hierarchies to avoid them?",
        "deeper_questions": [
            "Going deeper: how does Python's asyncio cooperative multitasking differ from preemptive OS thread scheduling when an unexpected synchronous blocking call is executed?",
            "How would you design a distributed lock with automatic lease expiration and fencing tokens to prevent split-brain execution across multiple workers?",
        ],
    },
    {
        "id": "rest_http",
        "name": "REST APIs & HTTP Protocol",
        "trigger_keywords": {"rest", "restful", "http", "endpoint", "get", "post", "put", "delete", "patch", "status code", "idempotent", "stateless"},
        "subconcepts": {
            "idempotency": {
                "keywords": {"idempotent", "idempotency", "safe", "retry", "repeatable", "duplicate"},
                "probe": "You explained REST methods. Could you clarify what idempotency means in HTTP, and which standard methods (GET, POST, PUT, DELETE) are considered idempotent?",
            },
            "put_vs_patch": {
                "keywords": {"put", "patch", "partial", "full replacement", "replace"},
                "probe": "You covered API endpoints. What is the precise architectural distinction between HTTP PUT and HTTP PATCH when updating a resource?",
            },
            "status_codes": {
                "keywords": {"401", "403", "404", "500", "201", "204", "status codes", "unauthorized", "forbidden"},
                "probe": "You walked through API request handling. What is the functional difference between returning a 401 Unauthorized versus a 403 Forbidden status code?",
            },
        },
        "general_probe": "You described the core REST structure. How should REST APIs handle versioning without breaking existing mobile or client integrations?",
        "deeper_questions": [
            "Going deeper: how would you design an end-to-end idempotency mechanism for payment APIs using client-supplied idempotency keys and distributed storage?",
            "How do conditional HTTP requests using ETags and If-None-Match headers reduce network bandwidth and prevent concurrent update overwrites?",
        ],
    },
    {
        "id": "auth_jwt",
        "name": "Authentication, JWT & Security",
        "trigger_keywords": {"jwt", "token", "authentication", "auth", "authorization", "refresh token", "access token", "oauth", "bearer"},
        "subconcepts": {
            "token_revocation": {
                "keywords": {"revoke", "revocation", "blacklist", "redis", "invalidate", "logout", "expiry"},
                "probe": "You explained how JWTs contain claims. Because JWTs are stateless, how do you handle immediate token invalidation when a user changes their password or logs out?",
            },
            "storage_security": {
                "keywords": {"httponly", "cookie", "localstorage", "xss", "csrf", "samesite"},
                "probe": "You covered token-based authentication. Why is storing sensitive authentication tokens in browser localStorage vulnerable, and how do HttpOnly Secure cookies provide better protection?",
            },
            "refresh_rotation": {
                "keywords": {"refresh", "rotation", "refresh token", "reuse detection", "sliding"},
                "probe": "You mentioned access tokens. How does refresh token rotation work to prevent replay attacks if a refresh token is intercepted?",
            },
        },
        "general_probe": "You described how tokens authenticate users. What information should never be included in a JWT payload, and why?",
        "deeper_questions": [
            "Going deeper: how do asymmetric signing algorithms (like RS256 using public/private key pairs) improve authentication microservice architecture over shared-secret HMAC (HS256)?",
            "In an OAuth2 Authorization Code flow with PKCE, what specific vulnerability does the Code Challenge and Code Verifier prevent compared to implicit grants?",
        ],
    },
    {
        "id": "caching_redis",
        "name": "Caching & Redis",
        "trigger_keywords": {"cache", "caching", "redis", "memcached", "ttl", "lru", "invalidation", "cache-aside"},
        "subconcepts": {
            "invalidation_strategies": {
                "keywords": {"invalidate", "invalidation", "cache-aside", "write-through", "write-behind", "stale"},
                "probe": "You explained how caching accelerates data access. How does the Cache-Aside pattern work, and how do you ensure the cache is invalidated when underlying data updates?",
            },
            "cache_stampede": {
                "keywords": {"stampede", "avalanche", "thundering herd", "penetration", "breakdown", "jitter"},
                "probe": "You covered cache usage. What is a cache stampede (or thundering herd problem) when a popular key expires, and how can you mitigate it?",
            },
            "eviction_policies": {
                "keywords": {"eviction", "lru", "lfu", "ttl", "memory max", "volatile"},
                "probe": "You mentioned memory storage. When Redis reaches its maximum memory limit, how does an LRU (Least Recently Used) eviction policy choose which keys to drop?",
            },
        },
        "general_probe": "You described the benefits of caching. What are the trade-offs between caching at the application layer versus using a dedicated distributed Redis cluster?",
        "deeper_questions": [
            "Going deeper: how do you maintain consistency between a relational database and a Redis cache during high-frequency writes without introducing race conditions?",
            "How does Redis achieve high throughput as a predominantly single-threaded event loop, and when do Redis commands (like KEYS or large SORTs) block all other clients?",
        ],
    },
    {
        "id": "react_frontend",
        "name": "React & Component Architecture",
        "trigger_keywords": {"react", "virtual dom", "component", "props", "state", "hooks", "useeffect", "usestate", "reconciliation", "rendering"},
        "subconcepts": {
            "useeffect_lifecycle": {
                "keywords": {"useeffect", "dependency", "dependencies", "cleanup", "lifecycle", "unmount"},
                "probe": "You described React component behavior. How does useEffect dependency tracking work, and why is a cleanup return function necessary for subscriptions or timers?",
            },
            "reconciliation_keys": {
                "keywords": {"key", "keys", "reconciliation", "diffing", "list", "identity"},
                "probe": "You mentioned rendering lists. What happens under the hood when you use array index as a key prop in React lists, and why can it cause state bugs?",
            },
            "performance_memo": {
                "keywords": {"usememo", "usecallback", "memo", "re-render", "rerender", "profiler"},
                "probe": "You covered component updates. When would you use useMemo or useCallback, and what is the cost of wrapping functions with them prematurely?",
            },
            "state_vs_props": {
                "keywords": {"state", "props", "mutable", "immutable", "parent", "child", "unidirectional"},
                "probe": "You touched on data flow. What is the fundamental difference between component state and props in React, and how is unidirectional data flow enforced?",
            },
        },
        "general_probe": "You described the basics of React state. How does React batch state updates across multiple setState calls to optimize rendering performance?",
        "deeper_questions": [
            "Going deeper into React architecture: how does the React Fiber reconciler break down rendering into interruptible units of work, and how do concurrency features like useTransition take advantage of this?",
            "How does Server-Side Rendering (SSR) hydration work in React, and what causes hydration mismatch errors between server-rendered HTML and client state?",
        ],
    },
    {
        "id": "nextjs_rendering",
        "name": "Next.js & Modern Web Rendering",
        "trigger_keywords": {"next.js", "nextjs", "ssr", "ssg", "isr", "server-side rendering", "static site generation", "hydration"},
        "subconcepts": {
            "ssr_vs_ssg": {
                "keywords": {"ssr", "ssg", "request time", "build time", "latency", "cdn"},
                "probe": "You explained web rendering. In what scenarios would you choose Server-Side Rendering (SSR) over Static Site Generation (SSG), and how does each impact TTFB (Time to First Byte)?",
            },
            "isr": {
                "keywords": {"isr", "incremental", "revalidate", "static", "background"},
                "probe": "Building on static rendering: what is Incremental Static Regeneration (ISR) in Next.js, and how does it balance static CDN speed with fresh data?",
            },
        },
        "general_probe": "You described rendering modes. How do server-side rendered pages handle SEO and social media metadata compared to pure client-side single page apps?",
        "deeper_questions": [
            "Going deeper: how do React Server Components (RSC) streaming and Suspense boundaries reduce client JavaScript bundle size and improve Core Web Vitals?",
        ],
    },
    {
        "id": "distributed_systems",
        "name": "Distributed Systems & Queues",
        "trigger_keywords": {"distributed", "microservices", "queue", "kafka", "rabbitmq", "event-driven", "cap theorem", "circuit breaker", "sharding"},
        "subconcepts": {
            "at_least_once": {
                "keywords": {"idempotent", "at-least-once", "duplicate", "deduplication", "ack", "consumer"},
                "probe": "You discussed message queues. Since distributed brokers like Kafka or RabbitMQ typically guarantee at-least-once delivery, how must consumers be architected to handle duplicate messages?",
            },
            "circuit_breaker": {
                "keywords": {"circuit breaker", "fallback", "retry", "cascade", "resilience"},
                "probe": "You mentioned microservice communication. How does the Circuit Breaker pattern prevent cascading failures when a downstream microservice experiences downtime?",
            },
            "cap_theorem": {
                "keywords": {"cap", "consistency", "availability", "partition", "partition tolerance"},
                "probe": "You touched on distributed databases. According to the CAP theorem, why can a distributed system never guarantee both strict consistency and 100% availability during network partitions?",
            },
        },
        "general_probe": "You described distributed architecture. How do you maintain data consistency across decoupled services without relying on slow distributed two-phase commits?",
        "deeper_questions": [
            "Going deeper: how does the Saga pattern manage long-running distributed transactions through compensating transactions, and how does orchestration compare to choreography?",
            "How does Consistent Hashing minimize key migration overhead when adding or removing database shard nodes dynamically?",
        ],
    },
    {
        "id": "machine_learning",
        "name": "Machine Learning & Model Evaluation",
        "trigger_keywords": {"machine learning", "model", "training", "overfitting", "gradient descent", "precision", "recall", "loss", "transformer", "embeddings"},
        "subconcepts": {
            "overfitting_regularization": {
                "keywords": {"overfitting", "regularization", "dropout", "l1", "l2", "validation", "generalization"},
                "probe": "You explained model training. When a machine learning model shows high training accuracy but poor validation performance, what techniques (such as regularization or dropout) mitigate overfitting?",
            },
            "precision_recall": {
                "keywords": {"precision", "recall", "f1", "imbalanced", "threshold", "auc", "roc"},
                "probe": "You discussed model metrics. In an imbalanced classification problem (like fraud detection), why is accuracy misleading, and how do precision and recall guide threshold tuning?",
            },
        },
        "general_probe": "You described the ML workflow. How do you prevent data leakage between your training and testing splits during feature engineering?",
        "deeper_questions": [
            "Going deeper: in transformer architectures, how does multi-head self-attention allow the model to jointly attend to information from different representation subspaces?",
        ],
    },
]


class AdaptiveFollowUpService:
    """
    Evaluates candidate responses to determine whether an answer-aware follow-up
    question is warranted, and synthesizes either a missing-concept probe or a deeper question.
    """

    @staticmethod
    def _clean_and_tokenize(text: str) -> List[str]:
        return re.findall(r"\b[a-zA-Z0-9_-]+\b", text.lower())

    @staticmethod
    def _extract_keywords(text: str) -> Set[str]:
        tokens = AdaptiveFollowUpService._clean_and_tokenize(text)
        return {w for w in tokens if w not in STOP_WORDS and len(w) > 2}

    def is_eligible_for_follow_up(
        self,
        answer_text: str,
        analysis_res: Dict[str, Any],
        intent: Optional[str] = None,
    ) -> bool:
        """
        Determines whether the candidate's answer is eligible for an answer-aware follow-up.
        Excludes:
        - Conversational commands (repeat, simplify, clarify, etc.)
        - Skip or Unanswered timeout requests
        - Empty or trivial responses (< 2 words)
        - Off-topic or irrelevant responses (e.g., candidate talking about food/movies)
        """
        if intent is not None:
            return False

        cleaned = (answer_text or "").strip()
        tokens = self._clean_and_tokenize(cleaned)
        if len(tokens) < 3:
            return False

        text_an = analysis_res.get("text_analysis") or {}
        perf_level = text_an.get("performance_level") or analysis_res.get("performance_level")

        if perf_level in ("off_topic", "no_answer"):
            return False

        # Additional off-topic guard: check if off-topic words dominate or relevance is very low
        off_topic_words = {"pizza", "food", "weather", "movie", "game", "vacation", "music", "restaurant"}
        if any(w in tokens for w in off_topic_words) and analysis_res.get("final_score", 50.0) <= 20.0:
            return False

        relevance = text_an.get("relevance_score") or analysis_res.get("relevance_score", 50.0)
        if relevance < 25.0:
            return False

        return True

    def find_matching_topic(self, question_text: str, answer_text: str) -> Optional[Dict[str, Any]]:
        """
        Identifies the primary topic from the question and candidate answer.
        """
        combined_text = f"{question_text} {answer_text}".lower()
        combined_keywords = self._extract_keywords(combined_text)

        best_topic = None
        max_matches = 0

        for topic in TOPIC_CATALOG:
            matches = len(topic["trigger_keywords"] & combined_keywords)
            # Also check phrase substring matches (e.g. "connection pooling", "virtual dom")
            for phrase in topic["trigger_keywords"]:
                if " " in phrase and phrase in combined_text:
                    matches += 2

            if matches > max_matches:
                max_matches = matches
                best_topic = topic

        if max_matches >= 1:
            return best_topic
        return None

    def identify_missing_concepts(
        self,
        topic: Dict[str, Any],
        answer_text: str,
    ) -> List[Tuple[str, str]]:
        """
        Identifies which subconcepts of the topic were omitted from the candidate's answer.
        Returns a list of (subconcept_id, probe_question).
        """
        answer_lower = answer_text.lower()
        answer_keywords = self._extract_keywords(answer_lower)

        missing: List[Tuple[str, str]] = []
        for sub_id, sub_info in topic.get("subconcepts", {}).items():
            kw_set = sub_info["keywords"]
            # Check if any keyword or phrase for this subconcept appeared in the answer
            has_match = any(kw in answer_keywords for kw in kw_set if " " not in kw) or any(
                phrase in answer_lower for phrase in kw_set if " " in phrase
            )
            if not has_match:
                missing.append((sub_id, sub_info["probe"]))

        return missing

    def generate_follow_up_question(
        self,
        question_text: str,
        answer_text: str,
        analysis_res: Dict[str, Any],
        role: str = "default",
        exclude_texts: Optional[Set[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Generates an adaptive follow-up question:
        - If answer is incomplete/partial: probes the missing concept of that topic.
        - If answer is correct/strong: asks a deeper question related to the same topic.
        - Avoids repeating any question in exclude_texts.
        """
        if exclude_texts is None:
            exclude_texts = set()

        text_an = analysis_res.get("text_analysis") or {}
        overall_score = analysis_res.get("final_score") or analysis_res.get("overall_score") or text_an.get("overall_score", 50.0)
        perf_level = text_an.get("performance_level") or analysis_res.get("performance_level", "average")
        relevance_score = text_an.get("relevance_score") or analysis_res.get("relevance_score", 50.0)
        technical_score = text_an.get("technical_score") or analysis_res.get("technical_score", 50.0)
        completeness_score = text_an.get("completeness_score") or analysis_res.get("completeness_score", 50.0)

        from app.services.conversational_ai import categorize_answer_quality

        quality_category = categorize_answer_quality(question_text, answer_text, analysis_res)

        # Decide whether candidate answer qualifies as strong/correct vs incomplete/partial
        is_strong = (
            quality_category == "strong"
            or perf_level == "strong"
            or overall_score >= 60.0
            or relevance_score >= 55.0
            or (relevance_score >= 50.0 and technical_score >= 50.0)
        )

        matched_topic = self.find_matching_topic(question_text, answer_text)

        if matched_topic:
            if is_strong:
                # Mode: Deeper question on the same topic
                for deeper_q in matched_topic.get("deeper_questions", []):
                    if deeper_q not in exclude_texts:
                        return {
                            "text": deeper_q,
                            "type": "technical",
                            "is_follow_up": True,
                            "mode": "deeper",
                            "topic": matched_topic["name"],
                        }
            else:
                # Mode: Probe missing concept
                missing_concepts = self.identify_missing_concepts(matched_topic, answer_text)
                for _sub_id, probe_q in missing_concepts:
                    if probe_q not in exclude_texts:
                        return {
                            "text": probe_q,
                            "type": "technical",
                            "is_follow_up": True,
                            "mode": "probe_missing",
                            "topic": matched_topic["name"],
                        }

                # Fallback to general probe on this topic
                general_probe = matched_topic.get("general_probe")
                if general_probe and general_probe not in exclude_texts:
                    return {
                        "text": general_probe,
                        "type": "technical",
                        "is_follow_up": True,
                        "mode": "probe_missing",
                        "topic": matched_topic["name"],
                    }

        # Algorithmic fallback if not in curated topics or pool exhausted
        q_keywords = self._extract_keywords(question_text)
        a_keywords = self._extract_keywords(answer_text)

        topic_word = list(q_keywords)[0] if q_keywords else "the system architecture"
        aspect_word = list(a_keywords)[0] if a_keywords else topic_word

        if is_strong:
            fallback_text = (
                f"Building on your solid explanation of {aspect_word}: "
                f"how would you architect this approach to handle high-concurrency scale and distributed failure modes?"
            )
            mode = "deeper"
        else:
            fallback_text = (
                f"You walked through the core idea of {aspect_word}. "
                f"What are the key trade-offs, edge cases, and performance failure modes when deploying this in production?"
            )
            mode = "probe_missing"

        if fallback_text in exclude_texts:
            fallback_text = f"Can you elaborate on the performance and reliability trade-offs of {topic_word} in a production environment?"

        return {
            "text": fallback_text,
            "type": "technical",
            "is_follow_up": True,
            "mode": mode,
            "topic": topic_word,
        }


adaptive_follow_up_service = AdaptiveFollowUpService()
