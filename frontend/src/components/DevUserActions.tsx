import React, { useState, useRef, useEffect } from 'react';

interface DevUserActionsProps {
  user: any;
  onChangePlan: (user: any) => void;
  onBanUser: (user: any) => void;
  onCancelPlan?: (user: any) => void;
}

const DevUserActions: React.FC<DevUserActionsProps> = ({ user, onChangePlan, onBanUser, onCancelPlan }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 150
      });
    }
  }, [showMenu]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className="dev-user-actions" style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        className="dev-action-btn"
        onClick={() => setShowMenu(!showMenu)}
        title="Actions"
      >
        ⋮
      </button>

      {showMenu && (
        <div
          ref={menuRef}
          className="dev-action-dropdown"
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            zIndex: 1000
          }}
        >
          <button
            onClick={() => {
              onChangePlan(user);
              setShowMenu(false);
            }}
            className="dev-action-item"
          >
            Change Plan
          </button>
          {user?.isPaidUser && onCancelPlan && (
            <button
              onClick={() => {
                onCancelPlan(user);
                setShowMenu(false);
              }}
              className="dev-action-item dev-action-danger"
            >
              Cancel Plan
            </button>
          )}
          <button
            onClick={() => {
              onBanUser(user);
              setShowMenu(false);
            }}
            className="dev-action-item dev-action-danger"
          >
            {user?.account_status === 'banned' ? 'Unban User' : 'Ban User'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DevUserActions;
