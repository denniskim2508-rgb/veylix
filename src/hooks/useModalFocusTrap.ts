import { useEffect, useRef, useCallback } from "react";
import { useNavigation } from "../components/NavigationProvider";
import type { GamehubAction } from "../types/controller";

interface UseModalFocusTrapOptions {
  isOpen: boolean;
  onClose: () => void;
  firstFocusId?: string;
}

export function useModalFocusTrap({ isOpen, onClose, firstFocusId }: UseModalFocusTrapOptions) {
  const { setActiveRegion, setFocus, handleAction } = useNavigation();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      setActiveRegion("modal");
      if (firstFocusId) {
        setTimeout(() => setFocus(firstFocusId), 0);
      }
    }
  }, [isOpen, setActiveRegion, setFocus, firstFocusId]);

  const handleModalAction = useCallback((action: GamehubAction) => {
    if (!isOpen) return false;
    if (action === "cancel") {
      onCloseRef.current();
      return true;
    }
    handleAction(action);
    return true;
  }, [isOpen, handleAction]);

  return { handleModalAction };
}
