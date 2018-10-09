import { autorun, action } from "mobx";
import { json } from "./json";

class HistoryState {
  constructor(public state: any, public id: number) {}
}

/**
 * first state includes all store's states
 */
class FirstHistoryState extends HistoryState {
}

export default class OptimizedUndo {

  private stateList: any[] = [];
  private stateFirstRun: boolean[] = [];

  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];

  private currentState: HistoryState;
  private firstState: FirstHistoryState;
  private isLoadingState = false;  // undo/redo will also trigger autorun, disable observe.

  constructor() {
    this.firstState = new FirstHistoryState([], -1);
    this.currentState = this.firstState;  
  }

  register(state: any) {
    if (this.getStateId(state) >= 0) {
      return;
    }
    this.stateList.push(state);
    this.stateFirstRun.push(true);

    autorun(() => this.observe(state));
  }

  getStateId = (state: any) => {
    return this.stateList.findIndex(s => s === state);
  }

  private observe = (state: any) => {
    const newState = new HistoryState(json.save(state), this.getStateId(state));

    // push first states for all stores
    let firstStates = this.firstState.state as HistoryState[];
    if (firstStates.length < this.stateList.length &&
        firstStates.findIndex(s => s.id === newState.id) < 0) {
      firstStates.push(newState);
      return;
    }
    
    if (this.isLoadingState) {
        this.isLoadingState = false;            
    } else {
        this.redoStack.length = 0;
        this.undoStack.push(this.undoStack.length > 0 ? this.currentState : this.firstState);
    }

    this.currentState = newState;
  }

  private swap(source: HistoryState[], target: HistoryState[]): void {
      const popped = source.pop();
      if (popped) {
          target.push(this.currentState);
          this.isLoadingState = true;
          
          if (popped instanceof FirstHistoryState) {
            (popped.state as HistoryState[]).forEach(historyState => {
              json.load(this.stateList[historyState.id], historyState.state);
            });
          } else {
            json.load(this.stateList[popped.id], popped.state);
          }
      }
  }

  get canUndo() {
      return !!this.undoStack.length;
  }

  @action.bound
  undo() {
      this.swap(this.undoStack, this.redoStack);
  }

  get canRedo() {
      return !!this.redoStack.length;
  }

  @action.bound
  redo() {
      this.swap(this.redoStack, this.undoStack);
  }
}
