from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_mail import Mail, Message
import os

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'  # replace with your email
app.config['MAIL_PASSWORD'] = 'your-email-password'  # replace with your email password

# Extensions
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
mail = Mail(app)

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)

# Create the database
with app.app_context():
    db.create_all()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    email = request.form['email']
    password = request.form['password']

    if not email.endswith('@gmail.com'):
        return jsonify({'error': 'Registration requires a @gmail.com email address.'}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    user = User(email=email, password=hashed_password)
    db.session.add(user)
    db.session.commit()

    try:
        msg = Message('Registration Confirmation',
                      sender='your-email@gmail.com',
                      recipients=[email])
        msg.body = 'Thank you for registering with our service!'
        mail.send(msg)

        return jsonify({'message': 'Registration successful! A confirmation email has been sent.'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)