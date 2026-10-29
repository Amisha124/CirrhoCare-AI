from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


MODEL_PATH = Path(__file__).with_name("liver_rf_model.pkl")
DATA_PATH = Path(__file__).with_name("sample_liver_dataset.csv")


def train():
    data = pd.read_csv(DATA_PATH)
    x = data.drop(columns=["target"])
    y = data["target"]
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.25, random_state=42, stratify=y)
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("forest", RandomForestClassifier(n_estimators=180, max_depth=6, random_state=42)),
    ])
    model.fit(x_train, y_train)
    score = accuracy_score(y_test, model.predict(x_test))
    joblib.dump({"model": model, "features": list(x.columns), "accuracy": score}, MODEL_PATH)
    print(f"Saved model to {MODEL_PATH} with validation accuracy {score:.2f}")


if __name__ == "__main__":
    train()
