from flask import Flask, redirect, url_for, session, request, render_template, jsonify
from functools import wraps
from msal import ConfidentialClientApplication
import os
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
import logging

# Load environment variables
load_dotenv()

# Validate required environment variables
required_env_vars = ["CLIENT_ID", "CLIENT_SECRET", "FLASK_SECRET_KEY"]
for var in required_env_vars:
    if not os.getenv(var):
        raise EnvironmentError(f"Missing required environment variable: {var}")

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
TENANT_ID = os.getenv("TENANT_ID", "common")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
REDIRECT_PATH = "/getAToken"
SCOPE = ["User.Read"]

# Flask app configuration
app = Flask(__name__, template_folder="../frontend/templates", static_folder="../frontend/static")
app.secret_key = os.getenv("FLASK_SECRET_KEY")
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=3600
)

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///chat_history.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# Initialize logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Define the ChatHistory model
class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(36), nullable=False)
    message = db.Column(db.Text, nullable=False)
    sender = db.Column(db.String(10), nullable=False)  # 'user' or 'assistant'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# Create the database tables
with app.app_context():
    db.create_all()

# Decorator for login-required routes
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

# MSAL application instance
msal_app = ConfidentialClientApplication(
    client_id=CLIENT_ID,
    client_credential=CLIENT_SECRET,
    authority=AUTHORITY
)

@app.route("/")
def index():
    if not session.get("user"):
        return render_template("index.html")
    return redirect(url_for("chatbot"))

@app.route("/login")
def login():
    session["state"] = os.urandom(16).hex()  # Generate state for CSRF protection
    auth_url = msal_app.get_authorization_request_url(
        scopes=SCOPE,
        redirect_uri=url_for("authorized", _external=True),
        state=session["state"]
    )
    return redirect(auth_url)

@app.route("/getAToken")
def authorized():
    try:
        if request.args.get("state") != session.get("state"):
            return "State verification failed", 400
        if "error" in request.args:
            return f"Authentication failed: {request.args['error_description']}", 401

        code = request.args.get("code")
        if not code:
            return "No auth code provided", 400

        result = msal_app.acquire_token_by_authorization_code(
            code=code,
            scopes=SCOPE,
            redirect_uri=url_for("authorized", _external=True)
        )

        if "error" in result:
            return f"Token acquisition failed: {result.get('error_description')}", 401

        session["user"] = result.get("id_token_claims")
        return redirect(url_for("chatbot"))
    except Exception as e:
        logging.error(f"Error during authorization: {e}")
        return "An error occurred during authorization", 500

@app.route("/logout")
def logout():
    session.clear()
    return redirect(
        f"{AUTHORITY}/oauth2/v2.0/logout?"
        f"post_logout_redirect_uri={url_for('index', _external=True)}"
    )

@app.route("/chatbot")
@login_required
def chatbot():
    session_id = session.get("session_id")
    if not session_id:
        session["session_id"] = str(uuid.uuid4())  # Generate a unique session ID
        logging.info(f"New session ID generated: {session['session_id']}")

    chat_history = get_chat_history(session["session_id"])
    user_name = session.get("user", {}).get("preferred_username", "User")
    return render_template("chatbot.html", user_name=user_name, chat_history=chat_history)

def save_message(session_id, message, sender):
    try:
        new_message = ChatHistory(session_id=session_id, message=message, sender=sender)
        db.session.add(new_message)
        db.session.commit()
        logging.info(f"Message saved: {message} (Sender: {sender})")
    except Exception as e:
        db.session.rollback()
        logging.error(f"Failed to save message: {e}")
        raise

def get_chat_history(session_id):
    try:
        messages = ChatHistory.query.filter_by(session_id=session_id).order_by(ChatHistory.timestamp).all()
        return [{"message": msg.message, "sender": msg.sender, "timestamp": msg.timestamp} for msg in messages]
    except Exception as e:
        logging.error(f"Failed to fetch chat history for session {session_id}: {e}")
        return []

@app.route("/send_message", methods=["POST"])
@login_required
def send_message():
    try:
        data = request.get_json()
        if not data or "message" not in data:
            return jsonify({"error": "No message provided"}), 400

        user_message = data["message"]
        session_id = session.get("session_id")
        
        # Save user message
        save_message(session_id, user_message, "user")
        
        # Simulate AI assistant response
        assistant_response = f"You said: {user_message}"
        
        # Save assistant response
        save_message(session_id, assistant_response, "assistant")
        
        return jsonify({
            "status": "success",
            "response": assistant_response
        })
    except Exception as e:
        logging.error(f"Error in send_message: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    try:
        app.run(debug=True)
    except Exception as e:
        logging.critical(f"Application failed to start: {e}")

