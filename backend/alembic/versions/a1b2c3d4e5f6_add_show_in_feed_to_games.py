"""add_show_in_feed_to_games

Revision ID: a1b2c3d4e5f6
Revises: 3bb87a578c40
Create Date: 2026-02-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3bb87a578c40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('games', sa.Column('show_in_feed', sa.Boolean(), nullable=True, server_default='true'))
    op.execute("UPDATE games SET show_in_feed = TRUE WHERE show_in_feed IS NULL")


def downgrade() -> None:
    op.drop_column('games', 'show_in_feed')
