
export async function importFromShift(fullAutoMode) {
    if (!currentDate) return alert("日付が選択されていません");
    if (!confirm('現在の入力内容は上書きされますがよろしいですか？')) return;

    // Check master data availability
    const master = window.masterStaffList || masterStaffList;
    if (!master || !master.staff_details) {
        alert("スタッフマスタが読み込まれていません。少し待ってから再試行してください。");
        return;
    }

    const [y, m, d] = currentDate.split('-');
    const dayNum = parseInt(d).toString(); // "05" -> "5"
    const docId = `${y}-${m}`;

    try {
        const shiftDocRef = doc(db, 'shift_submissions', docId);
        const shiftSnap = await getDoc(shiftDocRef);

        if (!shiftSnap.exists()) {
            alert(`${y}年${m}月のシフトデータが見つかりません`);
            return;
        }

        const shiftData = shiftSnap.data();
        const assignments = {}; // name -> role
        const shiftTypes = {}; // name -> 'A' | 'B'

        // Scan all staff in shift data
        Object.keys(shiftData).forEach(name => {
            const s = shiftData[name];
            if (s.assignments && s.assignments[dayNum]) {
                const role = s.assignments[dayNum];
                if (role !== '公休') {
                    assignments[name] = role;
                    // Determine Type
                    let type = 'A';
                    if (s.monthly_settings && s.monthly_settings.shift_type) {
                        type = s.monthly_settings.shift_type;
                    } else if (master.staff_details && master.staff_details[name]) {
                        type = master.staff_details[name].basic_shift || 'A';
                    }
                    shiftTypes[name] = type;
                }
            }
        });

        // Reset Lists (All 4 lists)
        staffList.early = [];
        staffList.late = [];
        staffList.closing_employee = [];
        staffList.closing_alba = [];

        // Populate Lists
        Object.keys(assignments).forEach(name => {
            const type = shiftTypes[name];
            const staffObj = { name: name, tasks: [] };
            const isEmployee = master.employees.includes(name);

            if (type === 'A') {
                // Early (Open) Shift
                if (isEmployee) staffList.early.push(staffObj); // Open Employees
                else staffList.late.push(staffObj); // Open Albas (Note: key is 'late' but means Open Albas)
            } else {
                // Late (Close) Shift
                if (isEmployee) staffList.closing_employee.push(staffObj); // Close Employees
                else staffList.closing_alba.push(staffObj); // Close Albas
            }
        });

        // Sort lists (Simple helper)
        const getSortIdx = (n) => {
            let i = master.employees.indexOf(n);
            if(i!==-1) return i;
            i = master.alba_early.indexOf(n);
            if(i!==-1) return i + 1000;
            i = master.alba_late.indexOf(n);
            if(i!==-1) return i + 2000;
            return 9999;
        };
        const sortFn = (a,b) => getSortIdx(a.name) - getSortIdx(b.name);

        staffList.early.sort(sortFn);
        staffList.late.sort(sortFn);
        staffList.closing_employee.sort(sortFn);
        staffList.closing_alba.sort(sortFn);

        // Full Auto Logic
        if (fullAutoMode) {
             // Reset fixed roles
             ['fixed_money_count','fixed_open_warehouse','fixed_open_counter',
              'fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(k => staffList[k] = "");

             // Identify Roles
             const fixedAssignments = {};

             Object.keys(assignments).forEach(name => {
                 const role = assignments[name];
                 const type = shiftTypes[name];
                 const isA = (type === 'A');

                 if (role.includes('金')) {
                     if (isA) staffList.fixed_money_count = name;
                     else staffList.fixed_money_collect = name;
                 } else if (role.includes('倉')) {
                     if (isA) staffList.fixed_open_warehouse = name;
                     else staffList.fixed_warehouses = name;
                 } else if (role.includes('サ')) {
                     if (isA) staffList.fixed_open_counter = name;
                     else staffList.fixed_counters = name;
                 }
                 // 'Hall' ('ホ') is a general role and does not map to a specific fixed task field.
                 // These staff will be available for auto-assignment.
             });

             // Apply Fixed Tasks (Logic adapted from setFixed)
             const defs={
                'fixed_money_count': [
                    {t:'金銭業務',s:'07:00',e:'08:15'},
                    {t:'朝礼',s:'09:00',e:'09:15'},
                    {t:'S台チェック(社員)',s:'09:15',e:'09:45'},
                    {t:'全体確認',s:'09:45',e:'10:00'}
                ],
                'fixed_open_warehouse': [
                    {t:'朝礼',s:'09:00',e:'09:15'},
                    {t:'倉庫番(特景)',s:'09:15',e:'10:00'}
                ],
                'fixed_open_counter': [
                    {t:'朝礼',s:'09:00',e:'09:15'},
                    {t:'カウンター開設準備',s:'09:15',e:'09:45'},
                    {t:'全体確認',s:'09:45',e:'10:00'}
                ],
                'fixed_money_collect': [{t:'金銭回収',s:'22:45',e:'23:15'}],
                'fixed_warehouses': [{t:'倉庫整理',s:'22:45',e:'23:15'}],
                'fixed_counters': [{t:'カウンター業務',s:'22:45',e:'23:00'}]
            };

            const applyTasks = (key) => {
                const name = staffList[key];
                if(!name) return;
                // Find staff
                let p = staffList.early.find(s => s.name === name);
                if (!p) p = staffList.late.find(s => s.name === name);
                if (!p) p = staffList.closing_employee.find(s => s.name === name);
                if (!p) p = staffList.closing_alba.find(s => s.name === name);

                if (p) {
                    const tasksToAdd = defs[key];
                    if(tasksToAdd){
                        tasksToAdd.forEach(task => {
                            p.tasks.push({ start: task.s, end: task.e, task: task.t, remarks: '（固定）' });
                        });
                        p.tasks.sort((a,b)=>a.start.localeCompare(b.start));
                    }
                }
            };

            ['fixed_money_count','fixed_open_warehouse','fixed_open_counter',
             'fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(k => applyTasks(k));
        }

        await saveStaffListToFirestore();
        refreshCurrentView();
        showToast("シフトから取り込みました");

    } catch(e) {
        console.error(e);
        alert("エラー: " + e.message);
    }
}
