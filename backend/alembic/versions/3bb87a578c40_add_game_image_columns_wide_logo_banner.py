"""add_game_image_columns_wide_logo_banner

Revision ID: 3bb87a578c40
Revises: 5f7b280da70b
Create Date: 2026-03-14 07:15:16.007396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3bb87a578c40'
down_revision: Union[str, Sequence[str], None] = '5f7b280da70b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('games', sa.Column('thumbnail_wide_url', sa.Text(), nullable=True))
    op.add_column('games', sa.Column('logo_url', sa.Text(), nullable=True))
    op.add_column('games', sa.Column('banner_url', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('games', 'banner_url')
    op.drop_column('games', 'logo_url')
    op.drop_column('games', 'thumbnail_wide_url')
