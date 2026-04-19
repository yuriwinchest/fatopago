import { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { Users, Trophy, RefreshCw, Newspaper, Settings, LogOut, ShieldAlert, Scale, ShieldCheck, BarChart3, ArrowRightLeft } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import PageLoader from '../components/ui/PageLoader';

// Hooks e Utils
import { useAdminData, ExtendedAdminUser } from '../hooks/useAdminData';

// Componentes Extraídos
import AdminMetrics from '../components/admin/AdminMetrics';
const UserManagement = lazy(() => import('../components/admin/UserManagement'));
const CycleManagement = lazy(() => import('../components/admin/CycleManagement'));
const WinnerManagement = lazy(() => import('../components/admin/WinnerManagement'));
const NewsManagement = lazy(() => import('../components/admin/NewsManagement'));
const SellerManager = lazy(() => import('../components/admin/SellerManager'));
const PromoMediaManager = lazy(() => import('../components/admin/PromoMediaManager'));
const AdminConfig = lazy(() => import('../components/admin/AdminConfig'));
const CycleConfig = lazy(() => import('../components/admin/CycleConfig'));
const SecurityAlertsPanel = lazy(() => import('../components/admin/SecurityAlertsPanel'));
const ManualReviewQueuePanel = lazy(() => import('../components/admin/ManualReviewQueuePanel'));
const WithdrawalReviewPanel = lazy(() => import('../components/admin/WithdrawalReviewPanel'));
const CollaboratorManager = lazy(() => import('../components/admin/CollaboratorManager'));
const SellerSalesReport = lazy(() => import('../components/admin/SellerSalesReport'));
const UserDetailModal = lazy(() => import('../components/admin/UserDetailModal'));

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'cycles' | 'winners' | 'sellers' | 'seller_sales' | 'news' | 'media' | 'alerts' | 'reviews' | 'withdrawals' | 'collaborators'>('users');
    
    const {
        loading,
        isAdmin,
        isCollaborator,
        totals,
        users,
        searchTerm,
        setSearchTerm,
        currentUsersPage,
        setCurrentUsersPage,
        selectedUser,
        setSelectedUser,
        showDetailsModal,
        setShowDetailsModal,
        handleDeleteUser,
        cycleOptions,
        selectedCycleOffset,
        setSelectedCycleOffset,
        cycleBundle,
        cycleLoading,
        cycleError,
        fetchCycleData,
        cycleWinners: _cycleWinners,
        winnersLoading,
        handleSaveWinnerFollowup,
        winnerFilterOptions,
        winnerStatusFilter,
        setWinnerStatusFilter,
        winnerSearchTerm,
        setWinnerSearchTerm,
        winnerSortOrder,
        setWinnerSortOrder,
        visibleCycleWinners,
        winnerDrafts,
        updateWinnerDraft,
        savingWinnerCycle,
        winnerHistoryByCycle,
        fetchWinnersHistory,
        adminNewsLoading,
        adminNewsItems,
        previousAdminNewsItems,
        currentNewsCycle,
        previousNewsCycle,
        newsPublishing,
        newsMessage,
        restoringNewsId,
        fetchNews,
        handlePublishNews,
        handleUpdateNews,
        handleDeleteNews,
        handleRestoreNews,
        handleLogout,
        sellers,
        sellersLoading,
        sellersError,
        loadSellers,
        isSavingSeller,
        saveSeller,
        deleteSeller,
        resetSellerPassword,
        securityAlerts,
        securityAlertsLoading,
        securityAlertsError,
        fetchSecurityAlerts,
        acknowledgeSecurityAlert,
        acknowledgingAlertId,
        openSecurityAlertsCount,
        criticalSecurityAlertsCount,
        pixWithdrawals,
        pixWithdrawalsLoading,
        pixWithdrawalsError,
        fetchPixWithdrawals,
        approvePixWithdrawalManualReview,
        rejectPixWithdrawalManualReview,
        completePixWithdrawalManually,
        getPixWithdrawalFullKey,
        pixWithdrawalResolvingId,
        openPixWithdrawalCount,
        pendingManualReviewPixWithdrawalCount,
        manualReviewTasks,
        manualReviewLoading,
        fetchManualReviewTasks,
        manualReviewVotesByTask,
        fetchManualReviewVotes,
        manualReviewSettlingTaskId,
        forceSettleManualReviewTask,
        cancelManualReviewTask,
        manualReviewBulkLoading,
        bulkSettleManualReviewTasks,
        bulkCancelManualReviewTasks,
        openManualReviewCount,
        homeConfig,
        isSavingHomeConfig,
        updateHomeConfig,
        activeCycleId,
        cycleConfig,
        isSavingCycleConfig,
        updateCycleConfig,
        collaborators,
        collaboratorsLoading,
        collaboratorsError,
        isSavingCollaborator,
        loadCollaborators,
        saveCollaborator,
        deleteCollaborator,
        registrationDateFilter,
        setRegistrationDateFilter,
        userHistory,
        userHistoryLoading,
        fetchUserHistory
    } = useAdminData(activeTab);

    const profileById = useMemo(() => {
        const map = new Map<string, ExtendedAdminUser>();
        (users || []).forEach(u => map.set(String(u.id), u));
        return map;
    }, [users]);

    const handleUserClick = (user: ExtendedAdminUser) => {
        setSelectedUser(user);
        fetchUserHistory(user.id);
        setShowDetailsModal(true);
    };

    const tabFallbackLabel: Record<typeof activeTab, string> = {
        users: 'Carregando usuários...',
        cycles: 'Carregando ciclos...',
        winners: 'Carregando ganhadores...',
        sellers: 'Carregando vendedores...',
        seller_sales: 'Carregando vendas...',
        news: 'Carregando notícias...',
        media: 'Carregando mídia e configuração...',
        alerts: 'Carregando alertas...',
        reviews: 'Carregando revisão manual...',
        withdrawals: 'Carregando saques...',
        collaborators: 'Carregando colaboradores...'
    };

    // Auto-switch to news tab for collaborators
    useEffect(() => {
        if (!loading && !isAdmin && isCollaborator && activeTab === 'users') {
            setActiveTab('news');
        }
    }, [loading, isAdmin, isCollaborator, activeTab]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0F0521]">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="h-12 w-12 animate-spin text-fuchsia-500" />
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-500/50">Carregando Dashboard...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin && !isCollaborator) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0F0521]">
                <div className="text-center">
                    <h1 className="text-2xl font-black text-red-500 uppercase tracking-widest mb-4">Acesso Negado</h1>
                    <button onClick={handleLogout} className="text-white underline uppercase text-xs font-bold tracking-widest">Sair</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0F0521] pb-20">
            <AppHeader />
            
            <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
                <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white uppercase sm:text-6xl font-display">
                            Painel <span className="text-fuchsia-500">{isCollaborator && !isAdmin ? 'Colaborador' : 'Admin'}</span>
                        </h1>
                        <p className="mt-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                            {isCollaborator && !isAdmin ? 'FatoPago News Collaborative Content' : 'Controle total da plataforma Fatopago'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleLogout}
                            className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-6 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 font-display"
                        >
                            <LogOut className="h-4 w-4" />
                            Sair do Painel
                        </button>
                    </div>
                </div>

                {!isCollaborator || isAdmin ? (
                    <AdminMetrics
                        totalUsers={totals?.total_users || 0}
                        totalReferralsSystem={totals?.total_referrals || 0}
                        totalCommissionsSystem={totals?.total_commissions || 0}
                        cycleRevenue={totals?.cycle_revenue || 0}
                        monthRevenue={totals?.month_revenue || 0}
                    />
                ) : null}

                <div className="mt-12">
                    <div className="mb-8 flex flex-wrap gap-2 overflow-x-auto pb-4 scrollbar-hide">
                        {[
                            { id: 'users', label: 'Usuários', icon: Users, adminOnly: true },
                            { id: 'cycles', label: 'Ciclos', icon: RefreshCw, adminOnly: true },
                            { id: 'winners', label: 'Vencedores', icon: Trophy, adminOnly: true },
                            { id: 'alerts', label: 'Alertas', icon: ShieldAlert, adminOnly: true },
                            { id: 'reviews', label: 'Revisão Manual', icon: Scale, adminOnly: true },
                            { id: 'withdrawals', label: 'Saques', icon: ArrowRightLeft, adminOnly: true },
                            { id: 'news', label: 'Notícias', icon: Newspaper, adminOnly: false },
                            { id: 'sellers', label: 'Vendedores', icon: Users, adminOnly: true },
                            { id: 'seller_sales', label: 'Vendas', icon: BarChart3, adminOnly: true },
                            { id: 'collaborators', label: 'Colaboradores', icon: ShieldCheck, adminOnly: true },
                            { id: 'media', label: 'Mídia & Config', icon: Settings, adminOnly: true },
                        ].filter(tab => !tab.adminOnly || isAdmin).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`relative flex h-11 items-center gap-2 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 font-display ${activeTab === tab.id
                                    ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20'
                                    : tab.id === 'alerts' && openSecurityAlertsCount > 0
                                        ? 'bg-red-500/10 text-red-200 hover:bg-red-500/15 animate-pulse'
                                        : tab.id === 'withdrawals' && pendingManualReviewPixWithdrawalCount > 0
                                            ? 'bg-red-500/10 text-red-200 hover:bg-red-500/15 animate-pulse'
                                            : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'}`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                                {tab.id === 'alerts' && openSecurityAlertsCount > 0 && (
                                    <>
                                        <span className="rounded-full border border-red-400/30 bg-red-500/20 px-2 py-0.5 text-[9px] font-black text-white">
                                            {openSecurityAlertsCount}
                                        </span>
                                        {criticalSecurityAlertsCount > 0 && (
                                            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.95)]" />
                                        )}
                                    </>
                                )}
                                {tab.id === 'reviews' && openManualReviewCount > 0 && (
                                    <span className="rounded-full border border-amber-400/30 bg-amber-500/20 px-2 py-0.5 text-[9px] font-black text-white">
                                        {openManualReviewCount}
                                    </span>
                                )}
                                {tab.id === 'withdrawals' && openPixWithdrawalCount > 0 && (
                                    <>
                                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black text-white ${pendingManualReviewPixWithdrawalCount > 0 ? 'border-red-400/30 bg-red-500/20' : 'border-cyan-400/30 bg-cyan-500/20'}`}>
                                            {openPixWithdrawalCount}
                                        </span>
                                        {pendingManualReviewPixWithdrawalCount > 0 && (
                                            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.95)] animate-pulse" />
                                        )}
                                    </>
                                )}
                                {tab.id === 'news' && adminNewsItems.length > 0 && (
                                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-white">
                                        {adminNewsItems.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <Suspense fallback={<PageLoader label={tabFallbackLabel[activeTab]} />}>
                        {activeTab === 'users' && (
                            <UserManagement
                                users={users}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                registrationDateFilter={registrationDateFilter}
                                setRegistrationDateFilter={setRegistrationDateFilter}
                                currentUsersPage={currentUsersPage}
                                setCurrentUsersPage={setCurrentUsersPage}
                                handleDelete={handleDeleteUser}
                                handleUserClick={handleUserClick}
                            />
                        )}

                        {activeTab === 'cycles' && (
                            <CycleManagement
                                cycleOptions={cycleOptions}
                                selectedCycleOffset={selectedCycleOffset}
                                setSelectedCycleOffset={setSelectedCycleOffset}
                                cycleBundle={cycleBundle}
                                cycleLoading={cycleLoading}
                                cycleError={cycleError}
                                fetchCycleData={fetchCycleData}
                                profileById={profileById}
                                handleUserClick={handleUserClick}
                            />
                        )}

                        {activeTab === 'winners' && (
                            <WinnerManagement
                                winners={visibleCycleWinners}
                                loading={winnersLoading}
                                onRefresh={fetchWinnersHistory}
                                filterOptions={winnerFilterOptions}
                                statusFilter={winnerStatusFilter}
                                setStatusFilter={(v) => setWinnerStatusFilter(v as any)}
                                searchTerm={winnerSearchTerm}
                                setSearchTerm={setWinnerSearchTerm}
                                sortOrder={winnerSortOrder}
                                setSortOrder={setWinnerSortOrder}
                                drafts={winnerDrafts}
                                onUpdateDraft={updateWinnerDraft}
                                onSaveFollowup={handleSaveWinnerFollowup}
                                isSaving={savingWinnerCycle}
                                historyByCycle={winnerHistoryByCycle}
                                profiles={profileById}
                            />
                        )}

                        {activeTab === 'alerts' && (
                            <SecurityAlertsPanel
                                alerts={securityAlerts}
                                loading={securityAlertsLoading}
                                error={securityAlertsError}
                                onRefresh={fetchSecurityAlerts}
                                onAcknowledge={acknowledgeSecurityAlert}
                                acknowledgingAlertId={acknowledgingAlertId}
                                onActionClick={(tab) => setActiveTab(tab as typeof activeTab)}
                            />
                        )}

                        {activeTab === 'reviews' && (
                                <ManualReviewQueuePanel
                                    tasks={manualReviewTasks}
                                    loading={manualReviewLoading}
                                    onRefresh={fetchManualReviewTasks}
                                    votesByTask={manualReviewVotesByTask}
                                    fetchVotes={fetchManualReviewVotes}
                                    settlingTaskId={manualReviewSettlingTaskId}
                                onForceSettle={forceSettleManualReviewTask}
                                onVoidTask={cancelManualReviewTask}
                                bulkLoading={manualReviewBulkLoading}
                                onBulkSettle={bulkSettleManualReviewTasks}
                                onBulkVoid={bulkCancelManualReviewTasks}
                            />
                        )}

                        {activeTab === 'withdrawals' && (
                            <WithdrawalReviewPanel
                                withdrawals={pixWithdrawals}
                                loading={pixWithdrawalsLoading}
                                error={pixWithdrawalsError}
                                resolvingId={pixWithdrawalResolvingId}
                                onRefresh={fetchPixWithdrawals}
                                onApproveManualReview={approvePixWithdrawalManualReview}
                                onRejectManualReview={rejectPixWithdrawalManualReview}
                                onCompleteManually={completePixWithdrawalManually}
                                onGetFullKey={getPixWithdrawalFullKey}
                            />
                        )}

                        {activeTab === 'news' && (
                            <NewsManagement
                                newsLoading={adminNewsLoading}
                                adminNewsItems={adminNewsItems}
                                previousAdminNewsItems={previousAdminNewsItems}
                                currentNewsCycle={currentNewsCycle}
                                previousNewsCycle={previousNewsCycle}
                                newsPublishing={newsPublishing}
                                newsMessage={newsMessage}
                                restoringNewsId={restoringNewsId}
                                handlePublishNews={handlePublishNews}
                                handleUpdateNews={handleUpdateNews}
                                handleDeleteNews={handleDeleteNews}
                                handleRestoreNews={handleRestoreNews}
                                fetchNews={fetchNews}
                            />
                        )}

                        {activeTab === 'sellers' && (
                            <SellerManager
                                sellers={sellers}
                                sellersLoading={sellersLoading}
                                sellersError={sellersError}
                                loadSellers={loadSellers}
                                isSavingSeller={isSavingSeller}
                                saveSeller={saveSeller}
                                deleteSeller={deleteSeller}
                                resetSellerPassword={resetSellerPassword}
                            />
                        )}

                        {activeTab === 'seller_sales' && (
                            <SellerSalesReport
                                sellers={sellers}
                                sellersLoading={sellersLoading}
                                sellersError={sellersError}
                                loadSellers={loadSellers}
                            />
                        )}

                        {activeTab === 'media' && (
                            <div className="space-y-8">
                                <AdminConfig
                                    homeConfig={homeConfig}
                                    isSavingHomeConfig={isSavingHomeConfig}
                                    updateHomeConfig={updateHomeConfig}
                                />
                                <CycleConfig
                                    activeCycleId={activeCycleId}
                                    cycleConfig={cycleConfig}
                                    isSavingCycleConfig={isSavingCycleConfig}
                                    updateCycleConfig={updateCycleConfig}
                                />
                                <PromoMediaManager />
                            </div>
                        )}

                        {activeTab === 'collaborators' && (
                            <CollaboratorManager
                                collaborators={collaborators}
                                loading={collaboratorsLoading}
                                error={collaboratorsError}
                                isSaving={isSavingCollaborator}
                                onRefresh={loadCollaborators}
                                onSave={saveCollaborator}
                                onDelete={deleteCollaborator}
                            />
                        )}
                    </Suspense>
                </div>
            </main>

            <Suspense fallback={null}>
                <UserDetailModal
                    show={showDetailsModal}
                    user={selectedUser}
                    history={userHistory}
                    loading={userHistoryLoading}
                    onClose={() => setShowDetailsModal(false)}
                    onDelete={handleDeleteUser}
                />
            </Suspense>
        </div>
    );
};

export default AdminDashboard;
