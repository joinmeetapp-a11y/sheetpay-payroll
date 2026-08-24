import React, { useState, useRef } from 'react';
import { Employee, BusinessDetails } from '../../types';
import { formatCurrency, recalculateEmployee } from '../../lib/taxEngine';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  Building2,
  Edit2,
  FileText,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  DollarSign,
  TrendingUp,
  Upload,
  Camera,
  CreditCard,
  Hash,
  Calendar,
  Layers,
} from 'lucide-react';

interface EmployeesViewProps {
  employees: Employee[];
  onUpdateEmployee: (employee: Employee, fieldChanged?: string) => void;
  onAddEmployee: (employee: Employee) => void;
  onViewPayslip: (employee: Employee) => void;
  business: BusinessDetails;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  onUpdateEmployee,
  onAddEmployee,
  onViewPayslip,
  business,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Custom departments list
  const [customDepartments, setCustomDepartments] = useState<string[]>([
    'Operations',
    'Logistics',
    'Executive',
    'Technology',
    'Administrative',
    'Finance & Legal',
  ]);

  // New Employee Form State
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newDepartment, setNewDepartment] = useState('Operations');
  const [isCreatingCustomDept, setIsCreatingCustomDept] = useState(false);
  const [customDeptInput, setCustomDeptInput] = useState('');

  // BIR, SSN, Frequency & Salary
  const [newBirNumber, setNewBirNumber] = useState('');
  const [newSsnNumber, setNewSsnNumber] = useState('');
  const [newPayFrequency, setNewPayFrequency] = useState<'monthly' | 'fortnightly' | 'weekly'>('monthly');
  const [newFrequencySalary, setNewFrequencySalary] = useState<number>(8500);

  // Photo & Contacts
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
  );
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('+1 (868) 555-0100');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Extract all active departments
  const allDeptsSet = new Set([...customDepartments, ...employees.map((e) => e.department)]);
  const departmentsList = Array.from(allDeptsSet);
  const filterDepts = ['all', ...departmentsList];

  // Calculate monthly equivalent salary from frequency
  const calculateMonthlyEquivalent = (amount: number, freq: 'monthly' | 'fortnightly' | 'weekly') => {
    if (freq === 'weekly') {
      return Number(((amount * 52) / 12).toFixed(2));
    }
    if (freq === 'fortnightly') {
      return Number(((amount * 26) / 12).toFixed(2));
    }
    return amount;
  };

  const currentMonthlyEquivalent = calculateMonthlyEquivalent(newFrequencySalary, newPayFrequency);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (isEdit && editingEmployee) {
          setEditingEmployee({ ...editingEmployee, avatar: result });
        } else {
          setNewPhotoUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNewDepartment = () => {
    if (customDeptInput.trim()) {
      const trimmed = customDeptInput.trim();
      if (!customDepartments.includes(trimmed)) {
        setCustomDepartments((prev) => [...prev, trimmed]);
      }
      setNewDepartment(trimmed);
      setCustomDeptInput('');
      setIsCreatingCustomDept(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const search = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (emp.name || '').toLowerCase().includes(search) ||
      (emp.employeeId || '').toLowerCase().includes(search) ||
      (emp.position || '').toLowerCase().includes(search) ||
      (emp.birNumber && emp.birNumber.toLowerCase().includes(search)) ||
      (emp.ssnNumber && emp.ssnNumber.toLowerCase().includes(search));
    const matchesDept = selectedDepartment === 'all' || emp.department === selectedDepartment;
    return matchesSearch && matchesDept;
  });

  const totalMonthlyPayroll = employees.reduce((sum, e) => sum + (e.grossPay || 0), 0);
  const totalNet = employees.reduce((sum, e) => sum + (e.netPay || 0), 0);

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const finalDepartment = isCreatingCustomDept && customDeptInput.trim() ? customDeptInput.trim() : newDepartment;
    if (isCreatingCustomDept && customDeptInput.trim() && !customDepartments.includes(customDeptInput.trim())) {
      setCustomDepartments((prev) => [...prev, customDeptInput.trim()]);
    }

    const calculatedMonthlyBasic = calculateMonthlyEquivalent(newFrequencySalary, newPayFrequency);
    const newEmpId = `EMP-0${employees.length + 1}`;
    const cleanBizName = (business?.name || 'company').toLowerCase().replace(/\s+/g, '');

    const rawEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: newName.trim(),
      employeeId: newEmpId,
      position: newPosition.trim() || 'Staff Specialist',
      department: finalDepartment,
      avatar: newPhotoUrl || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80`,
      email: newEmail.trim() || `${newName.toLowerCase().replace(/\s+/g, '.')}@${cleanBizName}.com`,
      phone: newPhone.trim() || '+1 (868) 555-0100',
      birNumber: newBirNumber.trim() || `104-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`,
      ssnNumber: newSsnNumber.trim() || `849-${Math.floor(10 + Math.random() * 90)}-${Math.floor(1000 + Math.random() * 9000)}`,
      payFrequency: newPayFrequency,
      frequencySalary: newFrequencySalary,
      basicPay: calculatedMonthlyBasic,
      overtimeHours: 0,
      overtimeRate: Number(((calculatedMonthlyBasic / 160) * 1.5).toFixed(2)),
      bonus: 0,
      commission: 0,
      allowances: 0,
      paye: 0,
      nis: 0,
      healthSurcharge: 0,
      otherDeductions: 0,
      grossPay: 0,
      netPay: 0,
      status: 'pending',
      bankName: 'Republic Bank Ltd',
      accountNumber: `4509-${Math.floor(1000 + Math.random() * 9000)}-01`,
      ytdGross: calculatedMonthlyBasic * 7,
      ytdPaye: 0,
      ytdNis: 0,
    };

    const calculated = recalculateEmployee(rawEmp);
    onAddEmployee(calculated);
    setIsAddModalOpen(false);

    // Reset Form
    setNewName('');
    setNewPosition('');
    setNewFrequencySalary(8500);
    setNewPayFrequency('monthly');
    setNewBirNumber('');
    setNewSsnNumber('');
    setNewEmail('');
    setIsCreatingCustomDept(false);
    setCustomDeptInput('');
  };

  const handleSaveEdit = () => {
    if (!editingEmployee) return;
    const recalculated = recalculateEmployee(editingEmployee);
    onUpdateEmployee(recalculated, 'basicPay');
    setEditingEmployee(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 select-none animate-in fade-in">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-emerald-600" />
            Employees Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your workforce, custom departments, BIR/SSN compliance, and payroll frequencies.
          </p>
        </div>

        <button
          id="add-employee-btn"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Overview Metric Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Headcount</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{employees.length} Staff Members</div>
          <div className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% BIR &amp; NIS Registered
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Base Payroll</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{formatCurrency(totalMonthlyPayroll)}</div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            Trinidad &amp; Tobago Dollar (TTD)
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Salary Payout</div>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-1">{formatCurrency(totalNet)}</div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            Direct Deposit / ACH Ready
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, ID, BIR, SSN, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-400 uppercase mr-1">Dept:</span>
          {filterDepts.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDepartment(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer shrink-0 ${
                selectedDepartment === dept
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Employees Table Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                <th className="px-6 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Department &amp; Role</th>
                <th className="px-4 py-3.5">Statutory IDs (BIR / SSN)</th>
                <th className="px-4 py-3.5">Frequency &amp; Pay</th>
                <th className="px-4 py-3.5">Statutory (PAYE / NIS)</th>
                <th className="px-4 py-3.5">Net Take-Home</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 space-y-2">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <div className="font-bold text-slate-700 text-sm">No employees found</div>
                    <div className="text-xs text-slate-400">Add employees to your organization to manage staff records and payroll.</div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const freq = emp.payFrequency || 'monthly';
                  const freqDisplay =
                    freq === 'weekly' ? 'Weekly' : freq === 'fortnightly' ? 'Fortnightly' : 'Monthly';
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-100 shadow-xs shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{emp.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-800">{emp.position}</div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                          {emp.department}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px]">
                        <div className="text-slate-800 font-semibold flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-bold">BIR:</span>
                          {emp.birNumber || '104-883-921'}
                        </div>
                        <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-bold">SSN:</span>
                          {emp.ssnNumber || '849-20-4100'}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono">
                        <div className="font-bold text-slate-900 text-sm">
                          {formatCurrency(emp.basicPay || 0)}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">/mo</span>
                        </div>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                          {freqDisplay} ({formatCurrency(emp.frequencySalary || emp.basicPay || 0)})
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] text-slate-600">
                        <div>PAYE: {formatCurrency(emp.paye || 0)}</div>
                        <div className="text-slate-400">NIS: {formatCurrency(emp.nis || 0)}</div>
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-emerald-600 text-sm">
                        {formatCurrency(emp.netPay || 0)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onViewPayslip(emp)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
                            title="View Individual Payslip"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
                            title="Edit Employee & Profile"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src={editingEmployee.avatar}
                  alt={editingEmployee.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Edit Employee: {editingEmployee.name}</h2>
                  <p className="text-xs text-slate-400 font-mono">{editingEmployee.employeeId}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Photo edit trigger */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <img
                  src={editingEmployee.avatar}
                  alt="Employee preview"
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <input
                    type="file"
                    ref={editFileInputRef}
                    onChange={(e) => handlePhotoUpload(e, true)}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-slate-700 font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    Change Employee Photo
                  </button>
                  <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG or WebP</p>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Position / Role</label>
                  <input
                    type="text"
                    value={editingEmployee.position}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Department</label>
                  <select
                    value={editingEmployee.department}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  >
                    {departmentsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">BIR Tax Number</label>
                  <input
                    type="text"
                    placeholder="104-892-334"
                    value={editingEmployee.birNumber || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, birNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SSN / NIS Number</label>
                  <input
                    type="text"
                    placeholder="849-20-4491"
                    value={editingEmployee.ssnNumber || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, ssnNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Monthly Equivalent Basic (TTD)</label>
                  <input
                    type="number"
                    value={editingEmployee.basicPay}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        basicPay: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Pay Frequency</label>
                  <select
                    value={editingEmployee.payFrequency || 'monthly'}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        payFrequency: e.target.value as 'monthly' | 'fortnightly' | 'weekly',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="fortnightly">Fortnightly (26 pay periods/yr)</option>
                    <option value="weekly">Weekly (52 pay periods/yr)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-sm cursor-pointer"
                >
                  Save &amp; Recalculate Taxes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal (Lightbox) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Add New Employee</h2>
                  <p className="text-xs text-slate-400">Enroll workforce member with statutory compliance</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
              {/* Photo Upload Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group">
                  <img
                    src={newPhotoUrl}
                    alt="Employee Avatar"
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500 shadow-md"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-950/40 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handlePhotoUpload(e, false)}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Employee Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const randomPresetId = Math.floor(100 + Math.random() * 800);
                        setNewPhotoUrl(`https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80&r=${randomPresetId}`);
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer text-[11px]"
                    >
                      Random Avatar
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Upload employee portrait for payslips and TD4 tax identification.
                  </p>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Employee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rachel Hernandez"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Position & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Position / Job Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Logistics Coordinator"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Department *</label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCustomDept(!isCreatingCustomDept)}
                      className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      {isCreatingCustomDept ? 'Choose Existing' : '+ Custom Dept'}
                    </button>
                  </div>

                  {isCreatingCustomDept ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Type new department name..."
                        value={customDeptInput}
                        onChange={(e) => setCustomDeptInput(e.target.value)}
                        className="flex-1 px-3 py-2 border border-emerald-300 rounded-xl bg-emerald-50/50 font-medium text-slate-900"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddNewDepartment}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer hover:bg-emerald-700"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={newDepartment}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCreatingCustomDept(true);
                        } else {
                          setNewDepartment(e.target.value);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-900 focus:bg-white"
                    >
                      {departmentsList.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                      <option value="__custom__">➕ Create Custom Department...</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Statutory Numbers: BIR & SSN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    BIR Number <span className="text-slate-400 font-normal">(Inland Revenue)</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. 104-892-334"
                      value={newBirNumber}
                      onChange={(e) => setNewBirNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    SSN / NIS Number <span className="text-slate-400 font-normal">(National Insurance)</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. 849-20-4491"
                      value={newSsnNumber}
                      onChange={(e) => setNewSsnNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Salary Frequency Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Salary Pay Frequency *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPayFrequency('weekly');
                      if (newPayFrequency === 'monthly') setNewFrequencySalary(Number((newFrequencySalary / 4.333).toFixed(2)));
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                      newPayFrequency === 'weekly'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Weekly
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewPayFrequency('fortnightly');
                      if (newPayFrequency === 'monthly') setNewFrequencySalary(Number((newFrequencySalary / 2.166).toFixed(2)));
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                      newPayFrequency === 'fortnightly'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Fortnightly
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewPayFrequency('monthly');
                      if (newPayFrequency === 'weekly') setNewFrequencySalary(Number((newFrequencySalary * 4.333).toFixed(2)));
                      if (newPayFrequency === 'fortnightly') setNewFrequencySalary(Number((newFrequencySalary * 2.166).toFixed(2)));
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                      newPayFrequency === 'monthly'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              {/* Frequency Salary & Live Monthly Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {newPayFrequency === 'weekly'
                      ? 'Weekly Pay Amount (TTD) *'
                      : newPayFrequency === 'fortnightly'
                      ? 'Fortnightly Pay (TTD) *'
                      : 'Monthly Basic Salary (TTD) *'}
                  </label>
                  <input
                    type="number"
                    required
                    value={newFrequencySalary}
                    onChange={(e) => setNewFrequencySalary(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-slate-900 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
                    <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                      Tax Engine Conversion
                    </div>
                    <div className="text-sm font-black font-mono text-emerald-900 mt-0.5">
                      ≈ {formatCurrency(currentMonthlyEquivalent)} / month
                    </div>
                  </div>
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Work Email</label>
                  <input
                    type="email"
                    placeholder="rachel.h@apex.tt"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create &amp; Enroll Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
