from flask import Flask, redirect, url_for, session, request, render_template, jsonify
from functools import wraps
from msal import ConfidentialClientApplication
import os
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
import logging
import sqlite3
from openai import AzureOpenAI  # Pour Azure OpenAI

# Load environment variables
load_dotenv()

# Pour Azure OpenAI, vous auriez besoin des variables d'environnement suivantes
required_env_vars = [
    "CLIENT_ID", "CLIENT_SECRET", "FLASK_SECRET_KEY",
    "OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", 
    "AZURE_OPENAI_API_VERSION"
]

for var in required_env_vars:
    if not os.getenv(var):
        raise EnvironmentError(f"Missing required environment variable: {var}")

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
TENANT_ID = os.getenv("TENANT_ID", "common")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
REDIRECT_PATH = "https://127.0.0.1:5000/getAToken"
SCOPE = ["User.Read"]
completion_model_name = os.getenv("OPENAI_COMPLETION_MODEL")
embedding_model_name =  os.getenv("OPENAI_EMBEDDING_MODEL")

# Azure OpenAI configuration
openai_client = AzureOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

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
        
        # Generate a new session ID for chat history
        session["session_id"] = str(uuid.uuid4())
        logging.info(f"New session ID generated: {session['session_id']}")

        # Load chat history for the logged-in user's email
        user_email = session["user"].get("preferred_username")
        if user_email:
            user_chat_history = ChatHistory.query.filter_by(session_id=session["session_id"]).all()
            session["chat_history"] = [
                {"message": msg.message, "sender": msg.sender, "timestamp": msg.timestamp}
                for msg in user_chat_history
            ]
            logging.info(f"Loaded {len(session['chat_history'])} messages for user {user_email}")
        
        # Fetch rows from rh_database.db where email matches the user's email
        if user_email:
            try:
                # Use absolute path for the database connection
                db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instance", "rh_database.db")
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM employees WHERE email = ?", (user_email,))
                rows = cursor.fetchall()
                session["rh_data"] = rows
                if rows:
                    logging.info(f"Fetched {len(rows)} rows from rh_database.db for user {user_email}")
                else:
                    logging.warning(f"No data found in rh_database.db for user {user_email}")
            except Exception as e:
                logging.error(f"Failed to fetch data from rh_database.db: {e}")
                logging.error(f"Database path attempted: {db_path}")
            finally:
                if 'conn' in locals() and conn:
                    conn.close()

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
    # Ensure we have a session ID
    if not session.get("session_id"):
        session["session_id"] = str(uuid.uuid4())
        logging.info(f"New session ID generated: {session['session_id']}")

    # Get chat history for this session
    chat_history = session.get("chat_history", [])
    user_name = session.get("user", {}).get("name", "User")
    
    # If no preferred_username is available, try name or fallback to "User"
    if not user_name:
        user_name = session.get("user", {}).get("preferred_username", "User")
    
    return render_template("chatbot.html", user_name=user_name, chat_history=chat_history)

def save_message(session_id, message, sender):
    try:
        new_message = ChatHistory(session_id=session_id, message=message, sender=sender)
        db.session.add(new_message)
        db.session.commit()
        logging.info(f"Message saved: {message[:30]}... (Sender: {sender})")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Failed to save message: {e}")
        return False

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
        
        if not session_id:
            session["session_id"] = str(uuid.uuid4())
            session_id = session["session_id"]
            logging.info(f"Generated new session ID: {session_id}")
            
        # Save user message
        if not save_message(session_id, user_message, "user"):
            return jsonify({"error": "Failed to save message"}), 500
        
        # Process the message and generate a response
        # This is where you would integrate with an AI service
        assistant_response = f"I received your message: '{user_message}'. This is a placeholder response."
        
        # Save assistant response
        if not save_message(session_id, assistant_response, "assistant"):
            return jsonify({"error": "Failed to save assistant response"}), 500
        
        return jsonify({
            "status": "success",
            "response": assistant_response
        })
    except Exception as e:
        logging.error(f"Error in send_message: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/clear_chat", methods=["POST"])
@login_required
def clear_chat():
    try:
        session_id = session.get("session_id")
        if not session_id:
            return jsonify({"error": "No active session"}), 400
            
        # Delete all messages for this session
        ChatHistory.query.filter_by(session_id=session_id).delete()
        db.session.commit()
        
        # Generate a new session ID
        session["session_id"] = str(uuid.uuid4())
        logging.info(f"Chat cleared. New session ID: {session['session_id']}")
        
        return jsonify({"status": "success", "message": "Chat history cleared"})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error clearing chat: {e}")
        return jsonify({"error": "Failed to clear chat history"}), 500

@app.route("/process_input", methods=["POST"])
@login_required
def process_input():
    try:
        data = request.get_json()
        if not data or "query" not in data:
            return jsonify({"error": "No query provided"}), 400

        user_query = data["query"]
        user_email = session.get("user", {}).get("preferred_username")

        if not user_email:
            return jsonify({"error": "User email not found in session"}), 400

        # Fetch rows from rh_database.db where email matches the user's email
        try:
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instance", "rh_database.db")
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM employees WHERE email = ?", (user_email,))
            rows = cursor.fetchall()
            conn.close()
        except Exception as e:
            logging.error(f"Failed to fetch data from rh_database.db: {e}")
            logging.error(f"Database path attempted: {db_path}")
            return jsonify({"error": "Failed to fetch data"}), 500

        if not rows:
            return jsonify({"error": "No relevant data found"}), 404

        # Generate embeddings for the rows
        row_texts = [str(row) for row in rows]  # Convert rows to strings
        
        # Updated to use new OpenAI client syntax
        embedding_response = openai_client.embeddings.create(
            input=row_texts,
            model=embedding_model_name  # Nom de déploiement Azure
        )
        embeddings = [item.embedding for item in embedding_response.data]

        # Store embeddings in session
        session["embeddings"] = embeddings

        # Use OpenAI Chat Completion to generate a response - updated to new syntax
        chat_completion = openai_client.chat.completions.create(
            model=completion_model_name,  # Nom de déploiement Azure
            messages=[
                {"role": "system", "content": "You are an assistant that helps users with their data."},
                {"role": "user", "content": f"User query: {user_query}\nContext: {row_texts}"}
            ]
        )

        assistant_response = chat_completion.choices[0].message.content

        return jsonify({
            "status": "success",
            "response": assistant_response
        })
    except Exception as e:
        logging.error(f"Error in process_input: {e}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

if __name__ == "__main__":
    try:
        app.run(debug=True, ssl_context='adhoc')  # Using adhoc SSL for development
    except Exception as e:
        logging.critical(f"Application failed to start: {e}")