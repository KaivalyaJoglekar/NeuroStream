import os

file_path = r'e:\CodingVacation\PracticeRepos\NeuroStream\FINALDOCUMENT.txt'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Abstract
content = content.replace('Amazon Elastic Container Service (AWS ECS) for containerized ML pipelines', 'Amazon Elastic Compute Cloud (AWS EC2) for scalable ML pipelines')

# Intro
content = content.replace('spanning serverless containers and edge networks', 'spanning virtualized cloud compute instances, serverless functions, and edge networks')

# Section 2.3A header
content = content.replace('A. Containerized Orchestration (AWS ECS)', 'A. Virtualized Cloud Compute (AWS EC2)')
content = content.replace('Amazon Elastic Container Service (AWS ECS) is a fully managed container orchestration service that allows developers to run Docker applications at scale.', 'Amazon Elastic Compute Cloud (AWS EC2) is a web service that provides secure, resizable compute capacity in the cloud.')
content = content.replace('deployed as containerized tasks managed by AWS ECS using the serverless Fargate compute engine.', 'deployed on scalable virtual machines managed natively via AWS EC2.')
content = content.replace('By utilizing ECS Fargate, these Python FastAPI services can dynamically scale out their container replicas', 'By utilizing specific EC2 auto scaling groups, these Python FastAPI services can dynamically expand their compute nodes')

# Section 3.2
content = content.replace('execution threads in the Docker containers.', 'execution threads running on the EC2 instances.')

# Section 5 Results
content = content.replace('(packaged cleanly in AWS ECS Fargate)', '(packaged directly on AWS EC2)')
content = content.replace('while the ECS backend gracefully auto scaled to digest the queue.', 'while the EC2 worker instances gracefully auto scaled to digest the queue.')

# Section 6 Discussion
content = content.replace('across AWS ECS and Serverless Lambda minimized operational compute costs drastically relative to provisioning monolithic EC2 server instances.', 'seamlessly across AWS EC2 fleets and Serverless Lambda minimized operational compute costs drastically relative to legacy, monolithic bare metal server deployments.')

# Section 7 Conclusion
content = content.replace('AWS ECS containers', 'AWS EC2 instances')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
