import os

file_path = r'e:\CodingVacation\PracticeRepos\NeuroStream\FINALDOCUMENT.txt'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace em-dashes with commas
content = content.replace('—', ', ')

# Replace hyphens surrounded by spaces with commas/colons
content = content.replace(' - ', ', ')

# Remove double quotes
content = content.replace('"', '')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
