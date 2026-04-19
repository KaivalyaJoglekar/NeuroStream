import json
import logging
import time
import pika
from pydantic import ValidationError
from app.schemas import ChatExportRequest, SummarizeExportRequest, ResearchExportRequest
from app.pdf_service import build_chat_pdf, build_summarize_pdf, build_research_pdf
from app.s3_service import upload_pdf

log = logging.getLogger(__name__)

def callback(ch, method, properties, body):
    try:
        data = json.loads(body)
        export_type = data.get("export_type")
        log.info(f"Received RMQ export task of type: {export_type}")

        if export_type == "chat":
            req = ChatExportRequest(**data)
            pdf = build_chat_pdf(req)
            url, key = upload_pdf(pdf, "chat")
        elif export_type == "summarize":
            req = SummarizeExportRequest(**data)
            pdf = build_summarize_pdf(req)
            url, key = upload_pdf(pdf, "summary")
        elif export_type == "research":
            req = ResearchExportRequest(**data)
            pdf = build_research_pdf(req)
            url, key = upload_pdf(pdf, "research")
        else:
            log.warning(f"Unknown export_type: {export_type}")
            return

        log.info(f"Successfully generated and uploaded PDF from RMQ: {key}")
    except ValidationError as e:
        log.error(f"Validation error parsing RMQ message: {e}")
    except Exception as e:
        log.error(f"Failed to process RMQ message: {e}")

def start_consumer():
    while True:
        try:
            credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_pass)
            parameters = pika.ConnectionParameters(host=settings.rabbitmq_host, credentials=credentials)
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            channel.queue_declare(queue='pdf_export_queue', durable=True)
            channel.basic_consume(queue='pdf_export_queue', on_message_callback=callback, auto_ack=True)
            log.info(f"Started RabbitMQ consumer for MS7 on host: {settings.rabbitmq_host}")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            log.warning("RabbitMQ not running. MS7 background RMQ consumer will retry in 10s...")
            time.sleep(10)
        except Exception as e:
            log.error(f"RMQ Consumer error: {e}")
            time.sleep(10)
