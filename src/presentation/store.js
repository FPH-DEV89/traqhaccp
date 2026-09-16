/**
 * TraqHACCP Pro - Presentation Layer: Reactive Store
 * Clean Architecture - State Management & Observer Pattern
 */

export class HACCPStore {
  constructor(repository, useCases) {
    this.repository = repository;
    this.useCases = useCases;
    this.subscribers = [];

    this.state = {
      activeTab: 'dashboard',
      currentOperator: this.repository.getBrigade()[0],
      establishment: this.repository.getEstablishment(),
      notification: null,
      allergenFilter: '',
      allergenExcludeList: [],
      cleaningZoneFilter: 'all',
      inspectionMode: false,
      docCategoryFilter: 'all',
      checklistTab: 'OUVERTURE'
    };
  }

  setInspectionMode(active) {
    this.setState({ inspectionMode: Boolean(active) });
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.subscribers.forEach(cb => cb(this.state));
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  setOperator(operatorObj) {
    this.setState({ currentOperator: operatorObj });
  }

  setActiveTab(tabName) {
    this.setState({ activeTab: tabName });
  }

  showNotification(message, type = 'info') {
    this.setState({ notification: { message, type, id: Date.now() } });
    setTimeout(() => {
      if (this.state.notification && this.state.notification.message === message) {
        this.setState({ notification: null });
      }
    }, 5000);
  }

  dismissNotification() {
    this.setState({ notification: null });
  }
}
