import os

file_path = r'e:\CodingVacation\PracticeRepos\NeuroStream\FINALDOCUMENT.txt'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all hyphens with a space to keep readability while 'removing' the hyphen character
# This covers high-performance, 768-dimensional, semi-supervised, etc.
content = content.replace('-', ' ')

# Ensure we didn't create double spaces
while '  ' in content:
    content = content.replace('  ', ' ')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
