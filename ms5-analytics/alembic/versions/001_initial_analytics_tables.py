"""001 - Initial analytics tables

Revision ID: 001
Revises: 
Create Date: 2025-04-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- user_video_events table ---
    op.create_table(
        'user_video_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.String(64), nullable=False),
        sa.Column('video_id', sa.String(64), nullable=False),
        sa.Column('event_type', sa.String(32), nullable=False),
        sa.Column('timestamp_sec', sa.Float(), nullable=True),
        sa.Column('query_text', sa.Text(), nullable=True),
        sa.Column('session_id', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
    )
    op.create_index('idx_uve_user_video', 'user_video_events', ['user_id', 'video_id'])
    op.create_index('idx_uve_event_type', 'user_video_events', ['event_type'])
    op.create_index('idx_uve_created_at', 'user_video_events', ['created_at'])

    # --- user_video_analytics table ---
    op.create_table(
        'user_video_analytics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.String(64), nullable=False),
        sa.Column('video_id', sa.String(64), nullable=False),
        sa.Column('important_timestamps', postgresql.JSON(), nullable=True),
        sa.Column('smart_highlights', postgresql.JSON(), nullable=True),
        sa.Column('query_history', postgresql.JSON(), nullable=True),
        sa.Column('revisited_segments', postgresql.JSON(), nullable=True),
        sa.Column('last_computed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('NOW()')),
        sa.UniqueConstraint('user_id', 'video_id', name='uq_user_video_analytics'),
    )
    op.create_index('idx_uva_user_video', 'user_video_analytics',
                    ['user_id', 'video_id'], unique=True)

    # --- Stub tables for MS4-owned data (read-only for MS5) ---
    op.create_table(
        'videos',
        sa.Column('video_id', sa.String(64), primary_key=True),
        sa.Column('title', sa.String(500), nullable=True),
        sa.Column('total_duration_seconds', sa.Float(), nullable=True),
        sa.Column('user_id', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text('NOW()')),
    )

    op.create_table(
        'video_chunks',
        sa.Column('chunk_id', sa.String(64), primary_key=True),
        sa.Column('video_id', sa.String(64), nullable=False),
        sa.Column('chunk_index', sa.Float(), nullable=False),
        sa.Column('start_time_seconds', sa.Float(), nullable=False),
        sa.Column('end_time_seconds', sa.Float(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('video_chunks')
    op.drop_table('videos')
    op.drop_index('idx_uva_user_video', table_name='user_video_analytics')
    op.drop_table('user_video_analytics')
    op.drop_index('idx_uve_created_at', table_name='user_video_events')
    op.drop_index('idx_uve_event_type', table_name='user_video_events')
    op.drop_index('idx_uve_user_video', table_name='user_video_events')
    op.drop_table('user_video_events')
