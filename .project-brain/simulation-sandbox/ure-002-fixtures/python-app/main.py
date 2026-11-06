from utils import format_greeting
import os

class DataStore:
  def __init__(self, capacity: int = 100):
    self.capacity = capacity
    self.items = []

  def add_item(self, item: str) -> bool:
    if len(self.items) >= self.capacity:
      return False
    self.items.append(item)
    return True

def start_server():
  try:
    store = DataStore(50)
    print("Server started")
  except Exception as e:
    print(f"Error: {e}")
