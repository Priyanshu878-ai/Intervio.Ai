"""
Vision Analysis Service for Intervio.Ai using OpenCV and MediaPipe.
Extracts non-verbal visual indicators including facial presence consistency,
head posture stability, approximate camera engagement, and landmark variance.
"""

import math
import logging
import os
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Configurable frame sampling settings for local CPU performance
DEFAULT_FRAME_SAMPLE_INTERVAL = 5  # Process 1 frame every 5 frames
MAX_PROCESSED_FRAMES = 100         # Maximum cap on processed frames per video
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"


class VisionAnalyzer:
    """
    Modular Vision Analyzer using OpenCV for video frame extraction and
    MediaPipe FaceLandmarker for non-verbal feature tracking.
    """

    def __init__(self, sample_interval: int = DEFAULT_FRAME_SAMPLE_INTERVAL):
        self.sample_interval = sample_interval
        self._detector = None
        self._load_attempted = False

    def _get_model_path(self) -> str:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        models_dir = os.path.join(current_dir, "..", "models")
        os.makedirs(models_dir, exist_ok=True)
        return os.path.abspath(os.path.join(models_dir, "face_landmarker.task"))

    def _get_detector(self):
        if self._detector is None and not self._load_attempted:
            self._load_attempted = True
            try:
                model_path = self._get_model_path()
                if not os.path.exists(model_path):
                    logger.info("Downloading MediaPipe face_landmarker.task...")
                    urllib.request.urlretrieve(MODEL_URL, model_path)

                import mediapipe as mp
                from mediapipe.tasks import python
                from mediapipe.tasks.python import vision

                base_options = python.BaseOptions(model_asset_path=model_path)
                options = vision.FaceLandmarkerOptions(
                    base_options=base_options,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                    num_faces=2,
                )
                self._detector = vision.FaceLandmarker.create_from_options(options)
                logger.info("MediaPipe FaceLandmarker loaded successfully!")
            except Exception as e:
                logger.warning(
                    f"Failed to load MediaPipe FaceLandmarker ({e}). Vision feature extraction will fallback."
                )
                self._detector = None
        return self._detector

    def analyze_video(self, video_path: str) -> Dict[str, Any]:
        """
        Analyzes a video file for non-verbal communication indicators.
        Safely handles missing files, invalid videos, and face-less recordings.
        """
        if not os.path.exists(video_path):
            return self._empty_result("Video file not found")

        try:
            import cv2
            import mediapipe as mp
        except Exception as e:
            logger.warning(f"Vision dependencies error: {e}")
            return self._empty_result(f"Vision processing unavailable: {str(e)}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return self._empty_result("Unable to open video file (corrupt or unsupported format)")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0 or fps <= 0:
            cap.release()
            return self._empty_result("Invalid video duration or empty frame count")

        video_duration = total_frames / float(fps)
        sample_step = max(self.sample_interval, total_frames // MAX_PROCESSED_FRAMES)

        detector = self._get_detector()

        frames_with_face = 0
        total_faces_count = 0
        processed_count = 0

        nose_positions: List[Tuple[float, float]] = []
        gaze_offsets: List[float] = []

        frame_idx = 0
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % sample_step == 0:
                    processed_count += 1
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                    if detector is not None:
                        try:
                            mp_image = mp.Image(
                                image_format=mp.ImageFormat.SRGB, data=rgb_frame
                            )
                            results = detector.detect(mp_image)

                            if results and results.face_landmarks:
                                num_faces = len(results.face_landmarks)
                                total_faces_count += num_faces
                                frames_with_face += 1

                                primary_face = results.face_landmarks[0]
                                # Nose tip landmark (index 1 in 468/478 face landmarks)
                                nose_tip = primary_face[1]
                                nose_x, nose_y = nose_tip.x, nose_tip.y
                                nose_positions.append((nose_x, nose_y))

                                # Approximate camera engagement: distance of nose tip from frame center (0.5, 0.5)
                                dist_from_center = math.sqrt(
                                    (nose_x - 0.5) ** 2 + (nose_y - 0.5) ** 2
                                )
                                gaze_offsets.append(dist_from_center)
                        except Exception as det_err:
                            logger.debug(f"Frame detection error: {det_err}")

                frame_idx += 1
        except Exception as e:
            logger.error(f"Error processing video frames: {e}")
        finally:
            cap.release()

        if processed_count == 0:
            return self._empty_result(
                "No video frames could be processed",
                duration=video_duration,
                total_frames=total_frames,
            )

        face_detected_ratio = round(frames_with_face / float(processed_count), 2)
        avg_faces_detected = (
            round(total_faces_count / float(processed_count), 2) if processed_count > 0 else 0.0
        )

        # Handle case with no face detected or insufficient landmarks
        if frames_with_face == 0 or len(nose_positions) < 2:
            return {
                "video_duration_seconds": round(video_duration, 2),
                "total_frames": total_frames,
                "processed_frames": processed_count,
                "face_detected_ratio": 0.0,
                "average_faces_detected": 0.0,
                "face_presence_score": 0.0,
                "head_movement_score": 0.0,
                "gaze_engagement_score": 0.0,
                "landmark_stability_score": 0.0,
                "visual_communication_score": 10.0,
                "feedback": "No face detected consistently in the video recording.",
            }

        # 1. Face Presence Score (0 - 100)
        face_presence_score = round(face_detected_ratio * 100.0, 1)

        # 2. Head Movement Score & Landmark Displacement Calculation
        displacements = [
            math.sqrt(
                (nose_positions[i][0] - nose_positions[i - 1][0]) ** 2
                + (nose_positions[i][1] - nose_positions[i - 1][1]) ** 2
            )
            for i in range(1, len(nose_positions))
        ]
        avg_disp = sum(displacements) / float(len(displacements)) if displacements else 0.0

        disp_var = (
            sum((d - avg_disp) ** 2 for d in displacements) / float(len(displacements))
            if displacements
            else 0.0
        )
        std_dev_disp = math.sqrt(disp_var)

        if avg_disp < 0.005:
            head_movement_score = 90.0
        elif avg_disp <= 0.03:
            head_movement_score = 100.0 - ((avg_disp - 0.005) / 0.025) * 20.0
        else:
            head_movement_score = max(20.0, 80.0 - ((avg_disp - 0.03) * 1000.0))

        head_movement_score = round(head_movement_score, 1)

        # 3. Landmark Stability Score
        landmark_stability_score = round(
            max(10.0, min(100.0, 100.0 - (std_dev_disp * 2000.0))), 1
        )

        # 4. Gaze Engagement Score (Camera framing alignment)
        avg_gaze_offset = sum(gaze_offsets) / float(len(gaze_offsets)) if gaze_offsets else 0.0
        if avg_gaze_offset <= 0.15:
            gaze_score = 95.0
        elif avg_gaze_offset <= 0.30:
            gaze_score = 95.0 - ((avg_gaze_offset - 0.15) / 0.15) * 35.0
        else:
            gaze_score = max(10.0, 60.0 - ((avg_gaze_offset - 0.30) * 100.0))

        gaze_engagement_score = round(gaze_score, 1)

        # 5. Visual Communication Score (Transparent weighted sum)
        weights = {"presence": 0.30, "movement": 0.25, "gaze": 0.25, "stability": 0.20}
        visual_score = round(
            (weights["presence"] * face_presence_score)
            + (weights["movement"] * head_movement_score)
            + (weights["gaze"] * gaze_engagement_score)
            + (weights["stability"] * landmark_stability_score),
            1,
        )

        # 6. Explainable Feedback
        feedback_items: List[str] = []
        if face_presence_score >= 80.0:
            feedback_items.append("Consistent face visibility throughout the video.")
        else:
            feedback_items.append("Intermittent face visibility detected.")

        if gaze_engagement_score >= 75.0:
            feedback_items.append("Good camera framing and visual engagement.")
        else:
            feedback_items.append("Noticeable off-center camera positioning or gaze deflection.")

        if head_movement_score < 60.0:
            feedback_items.append("Noticeable head movement or camera instability detected.")
        else:
            feedback_items.append("Controlled head posture and movement stability.")

        summary_feedback = " ".join(feedback_items)

        return {
            "video_duration_seconds": round(video_duration, 2),
            "total_frames": total_frames,
            "processed_frames": processed_count,
            "face_detected_ratio": face_detected_ratio,
            "average_faces_detected": avg_faces_detected,
            "face_presence_score": face_presence_score,
            "head_movement_score": head_movement_score,
            "gaze_engagement_score": gaze_engagement_score,
            "landmark_stability_score": landmark_stability_score,
            "visual_communication_score": visual_score,
            "feedback": summary_feedback,
        }

    def _empty_result(
        self, error_msg: str, duration: float = 0.0, total_frames: int = 0
    ) -> Dict[str, Any]:
        return {
            "video_duration_seconds": round(duration, 2),
            "total_frames": total_frames,
            "processed_frames": 0,
            "face_detected_ratio": 0.0,
            "average_faces_detected": 0.0,
            "face_presence_score": 0.0,
            "head_movement_score": 0.0,
            "gaze_engagement_score": 0.0,
            "landmark_stability_score": 0.0,
            "visual_communication_score": 0.0,
            "feedback": error_msg,
        }


vision_analyzer = VisionAnalyzer()
