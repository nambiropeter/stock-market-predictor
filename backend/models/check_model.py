import joblib
import os

# Since this script is IN the models folder, the model is in the same directory
model_filename = "stock_model.pkl"

if not os.path.exists(model_filename):
    print(f"❌ Error: Could not find {model_filename} in this folder.")
    print(f"Current folder content: {os.listdir('.')}")
else:
    model = joblib.load(model_filename)
    print("✅ Model loaded successfully!")
    
    if hasattr(model, 'feature_names_in_'):
        print("\n--- COPY THESE 14 NAMES EXACTLY ---")
        features = list(model.feature_names_in_)
        for i, name in enumerate(features):
            print(f"{i+1}. {name}")
    else:
        print("\nFeature names not saved in the model. We'll need to check the Notebook.")