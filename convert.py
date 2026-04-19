import re

with open(r'e:\CodingVacation\PracticeRepos\NeuroStream\overleaf.txt', 'r', encoding='utf-8') as f:
    author_block = f.read().strip()

with open(r'e:\CodingVacation\PracticeRepos\NeuroStream\FINALDOCUMENT.txt', 'r', encoding='utf-8') as f:
    text = f.read()

title = 'NeuroStream: A Scalable Polyglot Microservices Architecture for High Performance Conversational Video Intelligence'

text = text.replace('1. INTRODUCTION', '\\section{INTRODUCTION}')
text = text.replace('1.1 Literature Review', '\\subsection{Literature Review}')
text = text.replace('2. SYSTEM ARCHITECTURE & METHODOLOGY', '\\section{SYSTEM ARCHITECTURE \\& METHODOLOGY}')
text = text.replace('2.1 End to End Data Flow', '\\subsection{End to End Data Flow}')
text = text.replace('2.2 The Agentic RAG Engine', '\\subsection{The Agentic RAG Engine}')
text = text.replace('2.3 Hybrid Deployment Architecture', '\\subsection{Hybrid Deployment Architecture}')
text = text.replace('A. Virtualized Cloud Compute (AWS EC2)', '\\subsubsection{Virtualized Cloud Compute (AWS EC2)}')
text = text.replace('B. Serverless Computing (AWS Lambda)', '\\subsubsection{Serverless Computing (AWS Lambda)}')
text = text.replace('C. Edge Delivery (Vercel)', '\\subsubsection{Edge Delivery (Vercel)}')
text = text.replace('3. TECHNOLOGY STACK AND DATABASE SELECTION', '\\section{TECHNOLOGY STACK AND DATABASE SELECTION}')
text = text.replace('3.1 Database and State Management Technologies', '\\subsection{Database and State Management Technologies}')
text = text.replace('3.2 Programming Languages and Frameworks', '\\subsection{Programming Languages and Frameworks}')
text = text.replace('4. METHODOLOGY', '\\section{METHODOLOGY}')
text = text.replace('5. RESULTS & EVALUATION', '\\section{RESULTS \\& EVALUATION}')
text = text.replace('5.1 Microservice Domain Functional Breakdown', '\\subsection{Microservice Domain Functional Breakdown}')
text = text.replace('5.2 Operational Resilience', '\\subsection{Operational Resilience}')
text = text.replace('6. DISCUSSION', '\\section{DISCUSSION}')
text = text.replace('7. CONCLUSION', '\\section{CONCLUSION}')

text = re.sub(r'ABSTRACT\n(.*?)\n', r'\\begin{abstract}\n\1\n\\end{abstract}\n\n', text, count=1, flags=re.DOTALL)

text = re.sub(r'(PostgreSQL and pgvector):', r'\\textbf{\1}:', text)
text = re.sub(r'\n(Redis):', r'\n\\textbf{\1}:', text)
text = re.sub(r'\n(RabbitMQ):', r'\n\\textbf{\1}:', text)
text = re.sub(r'\n(AWS S3 \(Simple Storage Service\)):', r'\n\\textbf{\1}:', text)

text = re.sub(r'\n(Go \(Golang\)):', r'\n\\textbf{\1}:', text)
text = re.sub(r'\n(Python and FastAPI):', r'\n\\textbf{\1}:', text)
text = re.sub(r'\n(Node.js):', r'\n\\textbf{\1}:', text)
text = re.sub(r'\n(Java and Spring Boot):', r'\n\\textbf{\1}:', text)

text = re.sub(r'\n(User Workflow Orchestration \(MS4 Node\.js\))\n', r'\n\\textbf{\1}\n', text)
text = re.sub(r'\n(Media Processing Extraction \(MS1 Go\))\n', r'\n\\textbf{\1}\n', text)
text = re.sub(r'\n(AI Vision and NLP Perception \(MS2 Python FastAPI\))\n', r'\n\\textbf{\1}\n', text)
text = re.sub(r'\n(Search and Discovery Layer \(MS3 Python FastAPI\))\n', r'\n\\textbf{\1}\n', text)
text = re.sub(r'\n(Personalized Operational Analytics \(MS5 Python FastAPI\))\n', r'\n\\textbf{\1}\n', text)
text = re.sub(r'\n(Agentic Researcher and RAG Core \(MS6 Java Spring Boot\))\n', r'\n\\textbf{\1}\n', text)
text = re.sub(r'\n(Asynchronous Export Dispatcher \(MS7 Python FastAPI\))\n', r'\n\\textbf{\1}\n', text)

text = text.replace('`pgvector`', r'\texttt{pgvector}')
text = text.replace('`media_processing_jobs`', r'\texttt{media\_processing\_jobs}')
text = text.replace('`fpdf2`', r'\texttt{fpdf2}')
text = text.replace('`goroutines`', r'\texttt{goroutines}')
text = text.replace('`aws serverless java container`', r'\texttt{aws serverless java container}')

text = text.replace('%', r'\%')

for i in range(13, 0, -1):
    text = text.replace(f'[{i}]', f'\\cite{{{i}}}')

refs_pos = text.find('REFERENCES\n')
original_refs = ''
if refs_pos != -1:
    original_refs = text[refs_pos+11:]
    text = text[:refs_pos]

ref_items = []
lines = original_refs.strip().split('\n')
for line in lines:
    line = line.strip()
    if line.startswith('\\cite{'):
        matched = re.match(r'\\cite\{(\d+)\}\s+(.*)', line)
        if matched:
            ref_idx = matched.group(1)
            ref_content = matched.group(2)
            ref_content = ref_content.replace('“', '``').replace('”', '\'\'')
            ref_items.append(f'\\bibitem{{{ref_idx}}}\n{ref_content}')

bib_text = '\\begin{thebibliography}{15}\n\n' + '\n\n'.join(ref_items) + '\n\n\\end{thebibliography}'

text = text.replace('NeuroStream: A Scalable Polyglot Microservices Architecture for High Performance Conversational Video Intelligence', '').strip()

latex_code = f"""\\documentclass[conference]{{IEEEtran}}
\\usepackage{{cite}}
\\usepackage{{amsmath,amssymb,amsfonts}}
\\usepackage{{algorithmic}}
\\usepackage{{graphicx}}
\\usepackage{{textcomp}}
\\usepackage{{xcolor}}

\\begin{{document}}

\\title{{{title}}}

{author_block}

\\maketitle

{text}

{bib_text}

\\end{{document}}
"""

with open(r'e:\CodingVacation\PracticeRepos\NeuroStream\overleaf.txt', 'w', encoding='utf-8') as f:
    f.write(latex_code)
