/**
 * TraqHACCP Pro - Domain Entities & Value Objects
 * Clean Architecture - Pure Domain Layer
 */

import { HACCP_NORMS } from './constants.js';

export class Equipment {
  constructor({ id, name, type, min, max, current = 0, status = 'ok', lastLog = '-', operator = '-', history = [] }) {
    this.id = id;
    this.name = name;
    this.type = type; // 'froid_pos', 'froid_neg', 'chaud'
    this.min = min;
    this.max = max;
    this.current = current;
    this.status = status;
    this.lastLog = lastLog;
    this.operator = operator;
    this.history = history;
  }

  isConform() {
    return this.current >= this.min && this.current <= this.max;
  }

  recordTemperature(temp, operatorName) {
    this.current = parseFloat(temp.toFixed(1));
    this.lastLog = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.operator = operatorName;
    this.status = this.isConform() ? 'ok' : 'danger';
    this.history.unshift({
      timestamp: new Date().toISOString(),
      temp: this.current,
      operator: operatorName,
      status: this.status
    });
    if (this.history.length > 30) this.history.pop();
    return this.status;
  }
}

export class DeliveryRecord {
  constructor({ id, supplier, bl, truckTemp, prodTemp, category, conformPackaging = true, conformDlc = true, decision = 'Conforme', time, operator, photo = null }) {
    this.id = id || 'REC-' + Date.now().toString().slice(-5);
    this.supplier = supplier;
    this.bl = bl;
    this.truckTemp = parseFloat(truckTemp);
    this.prodTemp = parseFloat(prodTemp);
    this.category = category;
    this.conformPackaging = Boolean(conformPackaging);
    this.conformDlc = Boolean(conformDlc);
    this.decision = decision; // 'Conforme' | 'Refusé'
    this.time = time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.operator = operator;
    this.photo = photo;
  }

  isRejected() {
    return this.decision === 'Refusé' || !this.conformPackaging || !this.conformDlc;
  }
}

export class PreparationLabel {
  constructor({ id, name, batch, fabDate, dlcDate, durationDays = 3, quantity, allergens = [], operator, photo = null }) {
    this.id = id || 'PR-' + Date.now().toString().slice(-5);
    this.name = name;
    this.batch = batch || 'LOT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);
    this.fabDate = fabDate || new Date().toLocaleDateString('fr-FR');
    
    if (!dlcDate) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(durationDays, 10));
      this.dlcDate = d.toLocaleDateString('fr-FR');
    } else {
      this.dlcDate = dlcDate;
    }
    
    this.durationDays = parseInt(durationDays, 10);
    this.quantity = quantity;
    this.allergens = Array.isArray(allergens) ? allergens : [];
    this.operator = operator;
    this.photo = photo;
  }
}

export class DishAllergens {
  constructor({ id, name, category, allergens = [] }) {
    this.id = id || 'ALD-' + Date.now().toString().slice(-5);
    this.name = name;
    this.category = category;
    this.allergens = Array.isArray(allergens) ? allergens : [];
  }
}

export class CleaningTask {
  constructor({ id, title, zone, freq, status = 'pending', operator = '-', time = '-', ppeRequired = 'Gants, Tablier' }) {
    this.id = id;
    this.title = title;
    this.zone = zone; // 'cuisine', 'froid', 'plonge', 'salle'
    this.freq = freq;
    this.status = status; // 'done' | 'pending'
    this.operator = operator;
    this.time = time;
    this.ppeRequired = ppeRequired;
  }

  toggle(operatorName) {
    if (this.status === 'done') {
      this.status = 'pending';
      this.operator = '-';
      this.time = '-';
    } else {
      this.status = 'done';
      this.operator = operatorName;
      this.time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return this.status;
  }
}

export class Fryer {
  constructor({ id, name, volume = '10L', lastTpm = 14.0, status = 'ok', lastChange, operator = '-' }) {
    this.id = id;
    this.name = name;
    this.volume = volume;
    this.lastTpm = parseFloat(lastTpm);
    this.status = status;
    this.lastChange = lastChange || new Date().toLocaleDateString('fr-FR');
    this.operator = operator;
  }

  recordTpm(tpmValue, actionType, operatorName) {
    this.lastTpm = parseFloat(tpmValue);
    this.operator = operatorName;
    if (this.lastTpm > HACCP_NORMS.OILS.CRITICAL_TPM) {
      this.status = 'danger';
    } else if (this.lastTpm >= HACCP_NORMS.OILS.OPTIMAL_TPM) {
      this.status = 'warning';
    } else {
      this.status = 'ok';
    }

    if (actionType.toLowerCase().includes('vidange')) {
      this.lastChange = new Date().toLocaleDateString('fr-FR');
      this.lastTpm = 9.5;
      this.status = 'ok';
    }

    return this.status;
  }
}

export class CoolingCycle {
  constructor({ id, dish, startTemp, endTemp = 8.0, startTime, endTime, durationMinutes = 75, status = 'success', operator }) {
    this.id = id || 'COOL-' + Date.now().toString().slice(-5);
    this.dish = dish;
    this.startTemp = parseFloat(startTemp);
    this.endTemp = parseFloat(endTemp);
    this.startTime = startTime || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.endTime = endTime || new Date(Date.now() + durationMinutes * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.durationMinutes = parseInt(durationMinutes, 10);
    this.status = this.durationMinutes <= HACCP_NORMS.COOLING.MAX_DURATION_MINUTES && this.endTemp <= HACCP_NORMS.COOLING.END_MAX_TEMP ? 'success' : 'danger';
    this.operator = operator;
  }
}

export class DefrostCycle {
  constructor({ id, product, batchOrigin, startDate, maxDlcDate, chamberName = 'Chambre Froide Positive', status = 'en_cours', operator }) {
    this.id = id || 'DEF-' + Date.now().toString().slice(-5);
    this.product = product;
    this.batchOrigin = batchOrigin;
    this.startDate = startDate || new Date().toLocaleDateString('fr-FR');
    
    if (!maxDlcDate) {
      const d = new Date();
      d.setDate(d.getDate() + HACCP_NORMS.DEFROSTING.MAX_DAYS);
      this.maxDlcDate = d.toLocaleDateString('fr-FR');
    } else {
      this.maxDlcDate = maxDlcDate;
    }
    
    this.chamberName = chamberName;
    this.status = status; // 'en_cours' | 'consomme' | 'jete'
    this.operator = operator;
  }
}

export class NonConformity {
  constructor({ id, date, category5M = 'Matériel', severity = 'Majeure', equipOrSubject, cause, action, operator, status = 'Résolu' }) {
    this.id = id || 'NC-' + Date.now().toString().slice(-5);
    this.date = date || new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.category5M = category5M;
    this.severity = severity; // 'Mineure' | 'Majeure' | 'Critique'
    this.equipOrSubject = equipOrSubject;
    this.cause = cause;
    this.action = action;
    this.operator = operator;
    this.status = status;
  }
}

export class ChecklistItem {
  constructor({ id, label, zone, mandatory = true, checked = false, operator = '-', time = '-' }) {
    this.id = id;
    this.label = label;
    this.zone = zone;
    this.mandatory = Boolean(mandatory);
    this.checked = Boolean(checked);
    this.operator = operator;
    this.time = time;
  }

  toggle(operatorName) {
    this.checked = !this.checked;
    if (this.checked) {
      this.operator = operatorName;
      this.time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else {
      this.operator = '-';
      this.time = '-';
    }
    return this.checked;
  }
}

export class ChecklistRoutine {
  constructor({ type = 'OUVERTURE', date, items = [], validated = false, operator = '-', time = '-' }) {
    this.type = type; // 'OUVERTURE' | 'FERMETURE'
    this.date = date || new Date().toLocaleDateString('fr-FR');
    this.items = items.map(it => it instanceof ChecklistItem ? it : new ChecklistItem(it));
    this.validated = Boolean(validated);
    this.operator = operator;
    this.time = time;
  }

  isComplete() {
    return this.items.filter(it => it.mandatory).every(it => it.checked);
  }

  validate(operatorName) {
    this.validated = true;
    this.operator = operatorName;
    this.time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return this.validated;
  }
}

export class SanitaryDocument {
  constructor({ id, title, category, issuer, fileDate, expireDate, notes = '', fileData = null, status = 'valid' }) {
    this.id = id || 'DOC-' + Date.now().toString().slice(-5);
    this.title = title;
    this.category = category; // 'formation' | 'nuisibles' | 'analyses' | 'eau' | 'fds' | 'audit'
    this.issuer = issuer;
    this.fileDate = fileDate || new Date().toLocaleDateString('fr-FR');
    this.expireDate = expireDate || ''; // AAAA-MM-JJ ou JJ/MM/AAAA
    this.notes = notes;
    this.fileData = fileData; // base64 ou nom de fichier
    this.status = status;
  }

  isExpired() {
    if (!this.expireDate) return false;
    const parts = this.expireDate.includes('-') ? this.expireDate.split('-') : this.expireDate.split('/').reverse();
    const exp = new Date(parts[0], parts[1] - 1, parts[2]);
    return exp < new Date();
  }

  isExpiringSoon(days = 30) {
    if (!this.expireDate) return false;
    const parts = this.expireDate.includes('-') ? this.expireDate.split('-') : this.expireDate.split('/').reverse();
    const exp = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= days;
  }
}

export class PhControlRecord {
  constructor({ id, product, measuredPh, targetMaxPh = 4.3, comment = '', operator, time, status = 'ok' }) {
    this.id = id || 'PH-' + Date.now().toString().slice(-5);
    this.product = product;
    this.measuredPh = parseFloat(parseFloat(measuredPh).toFixed(2));
    this.targetMaxPh = parseFloat(parseFloat(targetMaxPh).toFixed(2));
    this.comment = comment;
    this.operator = operator;
    this.time = time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.status = this.measuredPh <= this.targetMaxPh ? 'ok' : 'danger';
  }

  isConform() {
    return this.measuredPh <= this.targetMaxPh;
  }
}

export class WeightControlRecord {
  constructor({ id, dishName, targetWeight, measuredWeight, tolerancePercent = 5.0, operator, time, status = 'ok' }) {
    this.id = id || 'WGT-' + Date.now().toString().slice(-5);
    this.dishName = dishName;
    this.targetWeight = parseFloat(targetWeight); // en grammes
    this.measuredWeight = parseFloat(measuredWeight); // en grammes
    this.tolerancePercent = parseFloat(tolerancePercent);
    this.operator = operator;
    this.time = time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const maxAllowed = this.targetWeight * (1 + this.tolerancePercent / 100);
    const minAllowed = this.targetWeight * (1 - this.tolerancePercent / 100);
    this.delta = Math.round(this.measuredWeight - this.targetWeight);
    this.status = (this.measuredWeight >= minAllowed && this.measuredWeight <= maxAllowed) ? 'ok' : 'warning';
  }

  isConform() {
    return this.status === 'ok';
  }
}

